/**
 * LocalTeeEnclave.spec.ts
 *
 * Spec-first TDD for the "Asynchronous Attestation + Atomic Execution" architecture.
 * This is the single source of truth for the local TEE domain layer.
 *
 * Architecture:
 *   domain/  → SessionKey, AttestationQuote, PolicyEvaluator (pure logic, zero I/O)
 *   ports/   → AttestationOracle, TransactionExecutor (interfaces)
 *   application/ → EnclaveService (orchestration, delegates to ports)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Domain Imports (will fail RED until implemented) ---
import { SessionKey } from '../../src/domain/SessionKey';
import { AttestationQuote } from '../../src/domain/AttestationQuote';
import { PolicyEvaluator, PolicyRuleset } from '../../src/domain/PolicyEvaluator';
import { TradeIntent } from '../../src/domain/TradeIntent';

// --- Port Imports ---
import type { AttestationOracle } from '../../src/ports/AttestationOracle';
import type { TransactionExecutor } from '../../src/ports/TransactionExecutor';

// --- Application Import ---
import { EnclaveService } from '../../src/application/EnclaveService';

// ============================================================
// 1. DOMAIN: SessionKey (Value Object)
// ============================================================
describe('SessionKey', () => {
    it('generates an ed25519 keypair on creation', () => {
        const key = SessionKey.generate();
        expect(key.publicKeyBase58()).toBeDefined();
        expect(key.publicKeyBase58().length).toBeGreaterThan(30);
    });

    it('produces deterministic output from a fixed seed', () => {
        const seed = new Uint8Array(32).fill(42);
        const a = SessionKey.fromSeed(seed);
        const b = SessionKey.fromSeed(seed);
        expect(a.publicKeyBase58()).toBe(b.publicKeyBase58());
    });

    it('signs a message and verifies the signature', () => {
        const key = SessionKey.generate();
        const message = 'aegis-12-test-payload';
        const signature = key.sign(message);
        expect(key.verify(message, signature)).toBe(true);
    });

    it('rejects a tampered message', () => {
        const key = SessionKey.generate();
        const signature = key.sign('original');
        expect(key.verify('tampered', signature)).toBe(false);
    });
});

// ============================================================
// 2. DOMAIN: AttestationQuote (Value Object)
// ============================================================
describe('AttestationQuote', () => {
    it('binds session pubkey into the report_data hash', () => {
        const key = SessionKey.generate();
        const policyHash = 'abc123';
        const quote = AttestationQuote.create(key, policyHash);

        expect(quote.quoteHash).toBeDefined();
        expect(quote.reportData).toContain(key.publicKeyBase58());
    });

    it('produces different hashes for different session keys', () => {
        const keyA = SessionKey.generate();
        const keyB = SessionKey.generate();
        const quoteA = AttestationQuote.create(keyA, 'same-policy');
        const quoteB = AttestationQuote.create(keyB, 'same-policy');
        expect(quoteA.quoteHash).not.toBe(quoteB.quoteHash);
    });

    it('produces different hashes for different policies', () => {
        const key = SessionKey.generate();
        const quoteA = AttestationQuote.create(key, 'policy-A');
        const quoteB = AttestationQuote.create(key, 'policy-B');
        expect(quoteA.quoteHash).not.toBe(quoteB.quoteHash);
    });
});

// ============================================================
// 3. DOMAIN: TradeIntent (Value Object)
// ============================================================
describe('TradeIntent', () => {
    it('creates a valid intent with destination and amount', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.01,
        });
        expect(intent.destination).toBe('4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k');
        expect(intent.amountSol).toBe(0.01);
    });

    it('rejects negative amounts', () => {
        expect(() => TradeIntent.create({ destination: 'abc', amountSol: -1 }))
            .toThrow('Amount must be positive');
    });

    it('rejects zero amounts', () => {
        expect(() => TradeIntent.create({ destination: 'abc', amountSol: 0 }))
            .toThrow('Amount must be positive');
    });
});

// ============================================================
// 4. DOMAIN: PolicyEvaluator (Pure Logic)
// ============================================================
describe('PolicyEvaluator', () => {
    const ruleset: PolicyRuleset = {
        maxTradeSol: 0.05,
        allowedDestinations: ['4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k'],
    };
    let evaluator: PolicyEvaluator;

    beforeEach(() => {
        evaluator = new PolicyEvaluator(ruleset);
    });

    it('approves a trade within limits and allowlist', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.01,
        });
        const result = evaluator.evaluate(intent);
        expect(result.approved).toBe(true);
    });

    it('denies a trade exceeding maxTradeSol', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 1.5,
        });
        const result = evaluator.evaluate(intent);
        expect(result.approved).toBe(false);
        expect(result.reason).toContain('exceeds');
    });

    it('denies a trade to an unlisted destination', () => {
        const intent = TradeIntent.create({
            destination: 'EvilWalletXYZ',
            amountSol: 0.01,
        });
        const result = evaluator.evaluate(intent);
        expect(result.approved).toBe(false);
        expect(result.reason).toContain('not in allowlist');
    });

    it('computes a deterministic policy hash', () => {
        const hashA = evaluator.policyHash();
        const hashB = evaluator.policyHash();
        expect(hashA).toBe(hashB);
        expect(hashA.length).toBeGreaterThan(10);
    });
});

// ============================================================
// 5. APPLICATION: EnclaveService (Orchestration)
// ============================================================
describe('EnclaveService', () => {
    let mockOracle: AttestationOracle;
    let mockExecutor: TransactionExecutor;
    let service: EnclaveService;

    const ruleset: PolicyRuleset = {
        maxTradeSol: 0.05,
        allowedDestinations: ['4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k'],
    };

    beforeEach(() => {
        mockOracle = {
            submitQuote: vi.fn().mockResolvedValue(true),
            isWhitelisted: vi.fn().mockResolvedValue(true),
        };
        mockExecutor = {
            execute: vi.fn().mockResolvedValue('mock-tx-signature-abc123'),
        };
        service = new EnclaveService(ruleset, mockOracle, mockExecutor);
    });

    describe('boot', () => {
        it('generates a session key and submits attestation quote', async () => {
            await service.boot();
            expect(mockOracle.submitQuote).toHaveBeenCalledTimes(1);
            expect(service.isAttested()).toBe(true);
        });

        it('exposes the session public key after boot', async () => {
            await service.boot();
            expect(service.sessionPublicKey()).toBeDefined();
        });
    });

    describe('execute', () => {
        it('evaluates policy and executes an approved trade', async () => {
            await service.boot();
            const intent = TradeIntent.create({
                destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
                amountSol: 0.01,
            });
            const txSig = await service.execute(intent);
            expect(txSig).toBe('mock-tx-signature-abc123');
            expect(mockExecutor.execute).toHaveBeenCalledTimes(1);
        });

        it('rejects a trade that exceeds policy limits', async () => {
            await service.boot();
            const intent = TradeIntent.create({
                destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
                amountSol: 999,
            });
            await expect(service.execute(intent)).rejects.toThrow('POLICY DENIED');
        });

        it('rejects execution before boot (no attestation)', async () => {
            const intent = TradeIntent.create({
                destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
                amountSol: 0.01,
            });
            await expect(service.execute(intent)).rejects.toThrow('not attested');
        });

        it('rejects execution if oracle reports key is no longer whitelisted', async () => {
            await service.boot();
            (mockOracle.isWhitelisted as ReturnType<typeof vi.fn>).mockResolvedValue(false);
            const intent = TradeIntent.create({
                destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
                amountSol: 0.01,
            });
            await expect(service.execute(intent)).rejects.toThrow('revoked');
        });
    });
});
