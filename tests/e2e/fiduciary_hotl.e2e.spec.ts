import { describe, it, expect, beforeAll } from 'vitest';
import { Connection } from '@solana/web3.js';
import { EnclaveService, FiduciaryEscalationError } from '../../src/application/EnclaveService';
import { MockAttestationOracle } from '../../src/infrastructure/MockAttestationOracle';
import { SolanaTransactionExecutor } from '../../src/infrastructure/SolanaTransactionExecutor';
import { TradeIntent } from '../../src/domain/TradeIntent';

/**
 * ATDD Spec: Fiduciary Human-On-The-Loop (Article 14)
 * 
 * Acceptance Criteria:
 * AC-1: The Gateway must flag transactions > 0.03 SOL with status 'escalated'.
 * AC-2: The Gateway must generate an intent envelope waiting for a co-signer.
 */
describe('Fiduciary HOTL Compliance (Article 14)', () => {
    let enclave: EnclaveService;

    beforeAll(async () => {
        const ruleset = {
            maxTradeSol: 0.05,
            escalationThresholdSol: 0.03, // Trades above this require human co-signer
            allowedDestinations: ['4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k']
        };

        const oracle = new MockAttestationOracle();
        const rpcConnection = new Connection('http://localhost:8899', 'confirmed');
        const executor = new SolanaTransactionExecutor(rpcConnection);

        enclave = new EnclaveService(ruleset, oracle, executor);
        await enclave.boot();
    });

    it('should throw FiduciaryEscalationError with a valid intent envelope when threshold is exceeded', async () => {
        // Attempt a trade of 0.04 SOL (exceeds escalation threshold, but within max limit)
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.04
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
        expect(errorCaught!.message).toContain('requires human co-signer');

        // Check AC-2: Intent envelope generated for human signer
        const envelope = errorCaught!.intentEnvelope;
        expect(envelope).toBeDefined();
        expect(envelope.domain_separator).toBe('AEGIS12_ESCALATE_V1');
        expect(envelope.status).toBe('WAITING_FOR_CO_SIGNER');
        expect(envelope.intent_details.amountSol).toBe(0.04);
        expect(envelope.intent_details.destination).toBe('4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k');
    });
});
