import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AegisPEP } from '../../src/infrastructure/AegisPEP';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';
import { AegisEnclave } from '../../src/application/PhalaEntrypoint';
import { AegisLocalStateStore } from '../../src/infrastructure/AegisLocalStateStore';
import * as fs from 'fs';

vi.mock('../../src/infrastructure/AegisSigner', () => ({
    AegisSigner: { create: vi.fn().mockResolvedValue({ enclaveDid: 'did:aegis:123', sign: vi.fn(), signEIP712: vi.fn().mockResolvedValue("mock-signature").mockResolvedValue('sig') }) }
}));

describe('Audit Remediation (P3 Hardening)', () => {
    let pep: AegisPEP;
    let signer: any;

    beforeEach(async () => {
        // Cleanup WAL files before each test
        if (fs.existsSync('/tmp/tenant_stats.wal')) fs.unlinkSync('/tmp/tenant_stats.wal');
        if (fs.existsSync('/tmp/evidence_store.wal')) fs.unlinkSync('/tmp/evidence_store.wal');
        if (fs.existsSync('/tmp/nonce_registry.json')) fs.unlinkSync('/tmp/nonce_registry.json');

        signer = await AegisSigner.create();
        const stateStore = new AegisLocalStateStore('/tmp');
        await stateStore.initialize();
        pep = new AegisPEP(signer, { 'tenant-1': ['0x123'] }, undefined, stateStore);
        
        const { Eip712Verifier } = await import('../../src/domain/Eip712Verifier');
        vi.spyOn(Eip712Verifier, 'verifySignature').mockImplementation(() => {});
    });

    const createRemediationReq = (amount: string, nonce: string, limits?: string) => ({
        agent: { currentTier: 'T1', did: 'did:agent:1' },
        action: { toolId: 'transfer', parameters: { recipient: '0xabc', amount } },
        dynamicPolicy: {
            policyConfig: {
                policyId: 'pol-audit',
                tenantId: 'tenant-1',
                version: '1.0.0',
                chainId: 1399811149,
                crossChainTarget: 'solana:devnet',
                maxAnomalyScore: 60,
                financialLimitsString: limits || '{"T1":"500"}',
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                nonce
            },
            signature: '0x' + '1b'.repeat(65)
        },
        context: { currentAnomalyScore: 0 }
    });

    describe('TOCTOU & Atomicity (P0-1, P0-2)', () => {
        it('should prevent concurrent spend limit bypass', async () => {
            const request = createRemediationReq('100', 'nonce-remedy-atomic');
            await expect(pep.enforce(request as any)).resolves.toBeDefined();
            await expect(pep.enforce(request as any)).rejects.toThrow('Nonce already used');
        });
    });

    describe('JSON Input Hardening (P0-5, S-01)', () => {
        it('should reject payloads exceeding 128KB', async () => {
            const enclave = AegisEnclave.getInstance();
            const hugePayload = 'a'.repeat(128 * 1024 + 1);
            const response = await enclave.processRequest(hugePayload);
            expect(JSON.parse(response).status).toBe('denied');
            expect(JSON.parse(response).error).toContain('exceeds 128KB');
        });

        it('should reject policy limits strings exceeding 1024 bytes', async () => {
            const maliciousLimits = '{"T1":"' + '0'.repeat(1024) + '"}';
            const request = createRemediationReq('100', 'nonce-remedy-malicious', maliciousLimits);
            await expect(pep.enforce(request as any)).rejects.toThrow('Limits exceed security bounds');
        });
    });
});
