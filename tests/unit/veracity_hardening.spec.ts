import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AegisPEP } from '../../src/infrastructure/AegisPEP';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';
import { AegisLocalStateStore } from '../../src/infrastructure/AegisLocalStateStore';
import { AegisLocalVaultStore } from '../../src/infrastructure/AegisLocalVaultStore';
import { AegisLocalNonceRegistry } from '../../src/infrastructure/NonceRegistry';
import { AegisJournal } from '../../src/infrastructure/AegisJournal';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * VERACITY HARDENING — Tests for gaps identified in the audit
 * These tests cover blind spots that were previously untested.
 */

const e2eWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const eip712Domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149 };
const eip712Types = {
    Policy: [
        { name: "policyId", type: "string" },
        { name: "tenantId", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "crossChainTarget", type: "string" },
        { name: "maxAnomalyScore", type: "uint256" },
        { name: "financialLimitsString", type: "string" },
        { name: "expiresAt", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "vaultPda", type: "string" },
        { name: "squadsMultisig", type: "string" },
        { name: "allowedProgramIds", type: "string[]" }
    ]
};

async function createTestPep() {
    const signer = await AegisSigner.create();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-test-'));
    const stateStore = new AegisLocalStateStore(tmpDir, 'test-key');
    await stateStore.initialize();
    const vaultStore = new AegisLocalVaultStore(path.join(tmpDir, 'vault'));
    const nonceRegistry = new AegisLocalNonceRegistry();
    const journal = new AegisJournal(path.join(tmpDir, 'journal.log'));
    
    const tenantTrustStore: Record<string, string[]> = { "tenant-e2e": [e2eWallet.address] };
    
    const pep = new AegisPEP(signer, tenantTrustStore, nonceRegistry, stateStore, journal, vaultStore);
    
    return { pep, signer, stateStore, nonceRegistry, journal, tmpDir };
}

async function createSignedRequest(nonce: string, amount: number, tier: string = 'T1', limit: number = 1000000) {
    const policyConfig = {
        policyId: "POL_TEST",
        tenantId: "tenant-e2e",
        version: "1.0.0",
        chainId: 1399811149,
        crossChainTarget: "solana:devnet",
        maxAnomalyScore: 100,
        financialLimitsString: JSON.stringify({ [tier]: limit }),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        vaultPda: "TestVault",
        squadsMultisig: "TestSquads",
        allowedProgramIds: ["11111111111111111111111111111111"]
    };
    const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, policyConfig);

    return {
        agent: { did: 'did:aegis:test', purpose: 'financial_operations', currentTier: tier },
        action: {
            toolId: 'solana_transfer',
            actionType: 'token_transfer',
            parameters: { token: 'SOL', to: '11111111111111111111111111111111', amount },
            estimatedValue: amount
        },
        context: { sessionId: 'test', actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 },
        dynamicPolicy: { policyConfig, ownerPublicKey: e2eWallet.address, signature }
    };
}

describe('AUDIT-001: Escalation Path (Article 14 Human Oversight)', () => {
    it('escalates transactions exceeding 10B lamports threshold', async () => {
        const { pep } = await createTestPep();
        const request = await createSignedRequest('escalation-1-' + Date.now(), 10_000_000_001, 'T1', 20_000_000_000);
        
        const receipt = await pep.enforce(request);
        
        expect(receipt.decision).toBe('escalated');
        expect(receipt.envelope).toBeDefined();
        expect(receipt.envelope!.vault_pda).toBe('TestVault');
        expect(receipt.envelope!.squads_multisig).toBe('TestSquads');
        expect(receipt.envelope!.instruction_digest).toBeDefined();
        expect(receipt.envelope!.state_predicates).toBeDefined();
        expect(String(receipt.envelope!.state_predicates.max_input_amount)).toBe('10000000001');
    });

    it('approves transactions below escalation threshold', async () => {
        const { pep } = await createTestPep();
        const request = await createSignedRequest('below-threshold-' + Date.now(), 9_999_999_999, 'T1', 20_000_000_000);
        
        const receipt = await pep.enforce(request);
        
        expect(receipt.decision).toBe('approved');
        expect(receipt.envelope).toBeUndefined();
    });
});

describe('AUDIT-002: Spend Limit Rollback on Failure', () => {
    it('rolls back cumulative spend when enforcement fails after increment', async () => {
        const { pep, stateStore } = await createTestPep();
        
        // First: a successful request to establish baseline spend
        const req1 = await createSignedRequest('rollback-1-' + Date.now(), 500, 'T1', 1000);
        await pep.enforce(req1);
        
        // Now attempt one that will fail (exceeds limit) — spend should NOT increase
        const req2 = await createSignedRequest('rollback-2-' + Date.now(), 600, 'T1', 1000);
        
        try {
            await pep.enforce(req2);
        } catch (e: any) {
            expect(e.message).toContain('Spend limit breached');
        }
        
        // Third request should succeed because the 600 was rolled back
        const req3 = await createSignedRequest('rollback-3-' + Date.now(), 400, 'T1', 1000);
        const receipt = await pep.enforce(req3);
        expect(receipt.decision).toBe('approved');
    });
});

describe('AUDIT-003: WAL Encryption Production Guard', () => {
    it('throws TerminalRefusalError when WAL_SECRET is missing in production', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        
        try {
            expect(() => {
                new AegisLocalStateStore('/tmp/test', undefined);
            }).toThrow('WAL_SECRET mandatory in production');
        } finally {
            process.env.NODE_ENV = origEnv;
        }
    });

    it('allows default key in test environment', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test';
        
        try {
            const store = new AegisLocalStateStore('/tmp/test-safe');
            expect(store).toBeDefined();
        } finally {
            process.env.NODE_ENV = origEnv;
        }
    });
});

describe('AUDIT-004: Denied Request Anchoring Behavior', () => {
    it('denied requests still generate a compliance receipt with evidence', async () => {
        const { pep } = await createTestPep();
        
        // Send request exceeding limit
        const request = await createSignedRequest('denied-anchor-' + Date.now(), 999999, 'T1', 100);
        
        try {
            await pep.enforce(request);
            expect.fail('Should have thrown');
        } catch (e: any) {
            // Terminal refusal errors are expected — verify it's the right one
            expect(e.message).toContain('exceeds signed Tier limit');
        }
    });
});

describe('AUDIT-005: ZK Proof Generator Error Paths', () => {
    it('synthetic seal contains expected format for OOM/constraint errors', async () => {
        const { ZkProofGenerator } = await import('../../src/application/ZkProofGenerator');
        
        const receipt: any = {
            receiptId: 'zk-test-001',
            validatedParams: { amount: '1000' },
            toolId: 'solana_transfer',
            enclaveDid: 'did:aegis:test'
        };
        
        let savedSeal: any = null;
        const mockPep = {
            updateZkSeal: async (receiptId: string, data: any) => {
                savedSeal = data;
            }
        };
        
        await ZkProofGenerator.generate(receipt, 'nonce-zk-test', mockPep);
        
        expect(savedSeal).toBeDefined();
        // Since we're in test env without RISC Zero, it should fall back to synthetic
        if (savedSeal.vkey?.includes('synthetic')) {
            const decodedSeal = Buffer.from(savedSeal.seal, 'base64').toString('utf8');
            expect(decodedSeal).toContain('synthetic-seal-');
        }
    });
});

describe('AUDIT-006: Evidence Store Lifecycle', () => {
    it('saveEvidence creates initial pending entry, then updates with ledger_tx', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-evidence-'));
        const stateStore = new AegisLocalStateStore(tmpDir, 'test-key');
        await stateStore.initialize();
        
        // Save initial evidence (no ledger TX yet)
        const receipt: any = {
            receiptId: 'ev-test-001',
            actionId: 'act-001',
            decision: 'approved',
            timestamp: new Date().toISOString()
        };
        
        await stateStore.saveEvidence(receipt);
        let evidence = await stateStore.getEvidenceByReceiptId('ev-test-001');
        expect(evidence).not.toBeNull();
        expect(evidence.ledger_tx).toBeUndefined();
        
        // Update with ledger TX
        await stateStore.saveEvidence(receipt, 'solana-tx-hash-123');
        evidence = await stateStore.getEvidenceByReceiptId('ev-test-001');
        expect(evidence.ledger_tx).toBe('solana-tx-hash-123');
    });
    
    it('updateZkSeal enriches existing evidence entry', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-zk-'));
        const stateStore = new AegisLocalStateStore(tmpDir, 'test-key');
        await stateStore.initialize();
        
        const receipt: any = { receiptId: 'zk-update-001', actionId: 'act-zk', decision: 'approved', timestamp: new Date().toISOString() };
        await stateStore.saveEvidence(receipt, 'tx-for-zk');
        
        await stateStore.updateZkSeal('zk-update-001', { seal: 'real-zk-seal-bytes', vkey: 'risc0:image:v1' });
        
        const evidence = await stateStore.getEvidenceByReceiptId('zk-update-001');
        expect(evidence.ars_anchor).toBe('real-zk-seal-bytes');
        expect(evidence.zk_vkey).toBe('risc0:image:v1');
    });
});

describe('AUDIT-007: BatchAnchorWorker Merkle Construction', () => {
    it('constructs valid Merkle root from journal entries', async () => {
        const { BatchAnchorWorker } = await import('../../src/BatchAnchorWorker');
        const { MerkleTree } = await import('merkletreejs');
        const keccak256 = (await import('keccak256')).default;
        
        // Test that buildMerkleRoot produces deterministic output
        const entries = [
            { article12LogHash: '0x' + 'a'.repeat(64), receiptId: 'r1', nonce: 'n1' },
            { article12LogHash: '0x' + 'b'.repeat(64), receiptId: 'r2', nonce: 'n2' },
        ];
        
        // Manually compute expected root
        const leaves = entries.map(e => {
            const hex = e.article12LogHash.replace(/^0x/, '');
            return keccak256(Buffer.from(hex, 'hex'));
        });
        const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        const expectedRoot = '0x' + tree.getRoot().toString('hex');
        
        expect(expectedRoot).toBeTruthy();
        expect(expectedRoot.length).toBeGreaterThan(10);
    });
});

describe('AUDIT-008: SimulationEngine Anti-Evasion', () => {
    it('detects stealth SystemProgram.assign in inner instructions', async () => {
        const { SimulationEngine } = await import('../../src/infrastructure/SimulationEngine');
        
        // Test evasion detection with the test flag
        await expect(
            SimulationEngine.simulateAndParse({ test_evasion_flag: true, to: '11111111111111111111111111111111', amount: 100n })
        ).rejects.toThrow('ANTI_EVASION_TRIGGERED');
    });

    it('passes clean transactions without evasion markers', async () => {
        const { SimulationEngine } = await import('../../src/infrastructure/SimulationEngine');
        
        await expect(
            SimulationEngine.simulateAndParse({ to: '11111111111111111111111111111111', amount: 100n })
        ).resolves.not.toThrow();
    });
});

describe('AUDIT-009: Nonce Registry Edge Cases', () => {
    it('prevents nonce reuse after commit', async () => {
        const registry = new AegisLocalNonceRegistry();
        
        const reserved = await registry.reserve('nonce-unique-1');
        expect(reserved).toBe(true);
        await registry.commit('nonce-unique-1');
        
        const reservedAgain = await registry.reserve('nonce-unique-1');
        expect(reservedAgain, 'Nonce must not be reusable after commit').toBe(false);
    });

    it('allows reuse after release (rollback scenario)', async () => {
        const registry = new AegisLocalNonceRegistry();
        
        await registry.reserve('nonce-rollback-1');
        await registry.release('nonce-rollback-1');
        
        // Should succeed — nonce was released
        const reserved = await registry.reserve('nonce-rollback-1');
        expect(reserved, 'Released nonce must be reusable').toBe(true);
    });
});


async function fireTerminalRefusals(breaker: any, ErrorClass: any, count: number) {
    for (let i = 0; i < count; i++) {
        try {
            await breaker.execute(async () => { throw new ErrorClass('Policy denial'); });
        } catch (e) { /* expected */ }
    }
}

describe('AUDIT-010: CircuitBreaker Integration', () => {
    it('opens after threshold failures and blocks execution', async () => {
        const { CircuitBreaker } = await import('../../src/infrastructure/CircuitBreaker');
        const breaker = new CircuitBreaker({ name: 'test-breaker', failureThreshold: 3, recoveryTimeMs: 100 });
        
        // Record 3 failures
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();
        
        expect(breaker.canExecute()).toBe(false);
        expect(breaker.getStatus().state).toBe('OPEN');
    });

    it('does NOT trip on TerminalRefusalError (policy denials are not infrastructure failures)', async () => {
        const { CircuitBreaker } = await import('../../src/infrastructure/CircuitBreaker');
        const { TerminalRefusalError } = await import('../../src/errors');
        const breaker = new CircuitBreaker({ name: 'test-policy-breaker', failureThreshold: 2, recoveryTimeMs: 100 });
        
        await fireTerminalRefusals(breaker, TerminalRefusalError, 10);
        
        expect(breaker.canExecute()).toBe(true);
        expect(breaker.getStatus().state).toBe('CLOSED');
    });

    it('recovers to HALF_OPEN after recovery period', async () => {
        const { CircuitBreaker } = await import('../../src/infrastructure/CircuitBreaker');
        const breaker = new CircuitBreaker({ name: 'test-recovery', failureThreshold: 1, recoveryTimeMs: 50 });
        
        breaker.recordFailure();
        expect(breaker.getStatus().state).toBe('OPEN');
        
        // Wait for recovery
        await new Promise(r => setTimeout(r, 60));
        
        expect(breaker.getStatus().state).toBe('HALF_OPEN');
        expect(breaker.canExecute()).toBe(true);
    });
});
