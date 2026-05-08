import { describe, it, expect, beforeAll } from 'vitest';
import { EnclaveService } from '../../src/application/EnclaveService';
import { MockAttestationOracle } from '../../src/infrastructure/MockAttestationOracle';
import { SolanaTransactionExecutor } from '../../src/infrastructure/SolanaTransactionExecutor';
import { TradeIntent } from '../../src/domain/TradeIntent';
import { Connection } from '@solana/web3.js';

describe('Chaos Resilience Testing', () => {
    let enclave: EnclaveService;
    let executor: SolanaTransactionExecutor;
    let oracle: MockAttestationOracle;

    beforeAll(async () => {
        const ruleset = {
            maxTradeSol: 0.05,
            allowedDestinations: ['4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k']
        };

        const rpcConnection = new Connection('http://localhost:8899', 'confirmed');
        oracle = new MockAttestationOracle();
        executor = new SolanaTransactionExecutor(rpcConnection);

        enclave = new EnclaveService(ruleset, oracle, executor);
    });

    it('should fail securely if execute is called before boot (No Attestation)', async () => {
        const unbootedEnclave = new EnclaveService(
            { maxTradeSol: 0.1, allowedDestinations: [] },
            oracle,
            executor
        );

        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.01
        });

        await expect(unbootedEnclave.execute(intent)).rejects.toThrow(/Enclave is not attested/);
    });

    it('should fail securely if the oracle revokes the session key mid-flight', async () => {
        await enclave.boot();

        // Simulate Oracle revoking the key
        oracle.isWhitelisted = async () => false;

        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.01
        });

        await expect(enclave.execute(intent)).rejects.toThrow(/Session key has been revoked/);
    });

    it('should fail securely on malformed Trade Intents (Negative Amount)', () => {
        expect(() => {
            TradeIntent.create({
                destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
                amountSol: -5
            });
        }).toThrow(/Amount must be positive/);
    });
});
