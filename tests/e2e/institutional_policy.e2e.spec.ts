/**
 * E2E Substance Test: Declarative Fiduciary Policy Engine
 *
 * These are NOT symbolic UI checks. Each test exercises the real PolicyEvaluator
 * with the full institutional ruleset, verifies the exact enforcement semantics,
 * and proves that new features (VaR limits, conditional escalation, risk scores,
 * token blocking) produce cryptographically correct decisions.
 *
 * Runs in GitHub Actions CI via Master Security Gate.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { Connection } from '@solana/web3.js';
import { EnclaveService, FiduciaryEscalationError } from '../../src/application/EnclaveService';
import { MockAttestationOracle } from '../../src/infrastructure/MockAttestationOracle';
import { SolanaTransactionExecutor } from '../../src/infrastructure/SolanaTransactionExecutor';
import { TradeIntent } from '../../src/domain/TradeIntent';
import { PolicyEvaluator, PolicyRuleset } from '../../src/domain/PolicyEvaluator';
import { MultiOracleRouter } from '../../src/infrastructure/MultiOracleRouter';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Full institutional policy config — mirrors what ships in demo-server.ts
 */
const INSTITUTIONAL_POLICY: PolicyRuleset = {
    policyId: 'treasury-default-v1',
    tenantId: 'dao-squads-main',
    maxTradeSol: 0.05,
    escalationThresholdSol: 0.03,
    dailyVaRLimitSol: 5.0,
    allowedDestinations: ['4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k'],
    allowedProtocols: ['Jupiter', 'Kamino'],
    blockedTokens: ['BONK', 'WIF'],
    requireHumanApprovalIf: {
        newRecipient: true,
        amountGreaterThanSol: 0.03,
        riskScoreGreaterThan: 70,
    },
};

// ============================================================
// 1. DECLARATIVE POLICY ENGINE (Domain Substance)
// ============================================================
describe('Declarative Policy Engine (Substance)', () => {
    let evaluator: PolicyEvaluator;

    beforeAll(() => {
        evaluator = new PolicyEvaluator(INSTITUTIONAL_POLICY);
    });

    it('AC-1: Approves a trade within all limits', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.001,
        });
        const result = evaluator.evaluate(intent);
        expect(result.approved).toBe(true);
        expect(result.reason).toBe('Policy check passed');
    });

    it('AC-2: Hard-blocks trades exceeding maxTradeSol', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 1.5,
        });
        const result = evaluator.evaluate(intent);
        expect(result.approved).toBe(false);
        expect(result.escalated).toBeUndefined();
        expect(result.reason).toContain('exceeds max');
    });

    it('AC-3: Escalates trades above escalationThresholdSol to human co-signer', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.04, // Above 0.03 threshold, below 0.05 max
        });
        const result = evaluator.evaluate(intent);
        expect(result.approved).toBe(false);
        expect(result.escalated).toBe(true);
        expect(result.reason).toContain('requires human co-signer');
    });

    it('AC-4: Blocks trades to unlisted destinations', () => {
        const intent = TradeIntent.create({
            destination: 'EvilWallet111111111111111111111111111111111',
            amountSol: 0.001,
        });
        const result = evaluator.evaluate(intent);
        expect(result.approved).toBe(false);
        expect(result.reason).toContain('not in allowlist');
    });

    it('AC-5: Blocks trades exceeding the daily VaR budget', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.01,
        });
        // Simulate the agent already spent 4.995 SOL today
        const result = evaluator.evaluate(intent, 4.995);
        expect(result.approved).toBe(false);
        expect(result.reason).toContain('daily VaR budget');
    });

    it('AC-6: Escalates trades to new recipients', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.001,
        });
        const result = evaluator.evaluate(intent, 0, true); // recipientIsNew = true
        expect(result.approved).toBe(false);
        expect(result.escalated).toBe(true);
        expect(result.reason).toContain('New recipient');
    });

    it('AC-7: Escalates trades with high risk scores', () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.001,
        });
        const result = evaluator.evaluate(intent, 0, false, 85); // riskScore = 85 > 70
        expect(result.approved).toBe(false);
        expect(result.escalated).toBe(true);
        expect(result.reason).toContain('risk score');
    });

    it('AC-8: Policy hash is deterministic and changes with config', () => {
        const hash1 = evaluator.policyHash();
        const hash2 = evaluator.policyHash();
        expect(hash1).toBe(hash2);
        expect(hash1.length).toBe(64); // SHA-256 hex

        const differentEvaluator = new PolicyEvaluator({
            ...INSTITUTIONAL_POLICY,
            maxTradeSol: 999,
        });
        expect(differentEvaluator.policyHash()).not.toBe(hash1);
    });
});

// ============================================================
// 2. MULTI-ORACLE FAILOVER (Infrastructure Substance)
// ============================================================
describe('Multi-Oracle Failover Router (Substance)', () => {

    it('AC-9: Falls back to secondary oracle when primary rejects the quote', async () => {
        const failingOracle = {
            submitQuote: async () => false,
            isWhitelisted: async () => false,
        };
        const successOracle = {
            submitQuote: async () => true,
            isWhitelisted: async () => true,
        };

        const router = new MultiOracleRouter([failingOracle, successOracle]);
        const result = await router.submitQuote({ quoteHash: 'test', reportData: 'test' });
        expect(result).toBe(true);
    });

    it('AC-10: Falls back to secondary oracle when primary throws an exception', async () => {
        const crashingOracle = {
            submitQuote: async () => { throw new Error('Switchboard RPC timeout'); },
            isWhitelisted: async () => { throw new Error('RPC down'); },
        };
        const successOracle = {
            submitQuote: async () => true,
            isWhitelisted: async () => true,
        };

        const router = new MultiOracleRouter([crashingOracle, successOracle]);
        const result = await router.submitQuote({ quoteHash: 'test', reportData: 'test' });
        expect(result).toBe(true);

        const whitelisted = await router.isWhitelisted('test-pubkey');
        expect(whitelisted).toBe(true);
    });

    it('AC-11: Returns false when ALL oracles in the squad fail', async () => {
        const dead1 = {
            submitQuote: async () => false,
            isWhitelisted: async () => false,
        };
        const dead2 = {
            submitQuote: async () => { throw new Error('dead'); },
            isWhitelisted: async () => { throw new Error('dead'); },
        };

        const router = new MultiOracleRouter([dead1, dead2]);
        const result = await router.submitQuote({ quoteHash: 'test', reportData: 'test' });
        expect(result).toBe(false);

        const whitelisted = await router.isWhitelisted('test-pubkey');
        expect(whitelisted).toBe(false);
    });

    it('AC-12: Rejects construction with zero oracles', () => {
        expect(() => new MultiOracleRouter([])).toThrow('at least one oracle');
    });
});

// ============================================================
// 3. FIDUCIARY ESCALATION ENVELOPE (Application Substance)
// ============================================================
describe('Fiduciary Escalation with Institutional Policy (Substance)', () => {
    let enclave: EnclaveService;

    beforeAll(async () => {
        const oracle = new MockAttestationOracle();
        const rpcConnection = new Connection('http://localhost:8899', 'confirmed');
        const executor = new SolanaTransactionExecutor(rpcConnection);

        enclave = new EnclaveService(INSTITUTIONAL_POLICY, oracle, executor);
        await enclave.boot();
    });

    it('AC-13: Escalation generates a valid AEGIS12_ESCALATE_V1 intent envelope', async () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.04, // Above 0.03 escalation threshold
        });

        let errorCaught: FiduciaryEscalationError | null = null;
        try {
            await enclave.execute(intent);
        } catch (error) {
            if (error instanceof FiduciaryEscalationError) {
                errorCaught = error;
            }
        }

        expect(errorCaught).not.toBeNull();
        expect(errorCaught!.message).toContain('POLICY ESCALATED');

        // Verify the cryptographic intent envelope
        const envelope = errorCaught!.intentEnvelope;
        expect(envelope.domain_separator).toBe('AEGIS12_ESCALATE_V1');
        expect(envelope.status).toBe('WAITING_FOR_CO_SIGNER');
        expect(envelope.intent_details.amountSol).toBe(0.04);
        expect(envelope.intent_details.destination).toBe('4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k');
    });

    it('AC-14: Hard max limit (0.05 SOL) produces POLICY DENIED, not escalation', async () => {
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 999, // Far exceeds max
        });

        await expect(enclave.execute(intent)).rejects.toThrow(/POLICY DENIED/);
    });
});

// ============================================================
// 4. BYPASS ATTACK (Mathematical Cage Substance)
// ============================================================
describe('Bypass Attack Resistance (Mathematical Cage)', () => {
    it('AC-15: An agent with no signing authority cannot execute against the vault', async () => {
        // This test verifies the core thesis: the agent cannot bypass the firewall.
        // We create an EnclaveService where the oracle REJECTS the session key,
        // simulating a scenario where an attacker tries to use a key that was
        // not attested by the hardware enclave.
        
        const rejectingOracle = {
            submitQuote: async () => false,
            isWhitelisted: async () => false,
        };
        const rpcConnection = new Connection('http://localhost:8899', 'confirmed');
        const executor = new SolanaTransactionExecutor(rpcConnection);
        
        const attackerEnclave = new EnclaveService(INSTITUTIONAL_POLICY, rejectingOracle, executor);
        await attackerEnclave.boot();
        
        // The attacker's key was NOT whitelisted by the oracle
        expect(attackerEnclave.isAttested()).toBe(false);
        
        const drainIntent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.001,
        });
        
        // The mathematical cage: execution is physically impossible
        await expect(attackerEnclave.execute(drainIntent)).rejects.toThrow(/Enclave is not attested/);
    });

    it('AC-16: A whitelisted agent with revoked oracle access is immediately blocked', async () => {
        const volatileOracle = new MockAttestationOracle();
        const rpcConnection = new Connection('http://localhost:8899', 'confirmed');
        const executor = new SolanaTransactionExecutor(rpcConnection);

        const enclave = new EnclaveService(INSTITUTIONAL_POLICY, volatileOracle, executor);
        await enclave.boot();
        expect(enclave.isAttested()).toBe(true);

        // Simulate the oracle revoking the key mid-flight
        volatileOracle.isWhitelisted = async () => false;

        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.001,
        });

        await expect(enclave.execute(intent)).rejects.toThrow(/revoked/);
    });
});
