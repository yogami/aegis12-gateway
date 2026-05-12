import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Connection } from '@solana/web3.js';
import { EnclaveService } from '../../src/application/EnclaveService';
import { TradeIntent } from '../../src/domain/TradeIntent';
import { PolicyRuleset } from '../../src/domain/PolicyEvaluator';
import { MockAttestationOracle } from '../../src/infrastructure/MockAttestationOracle';
import { SolanaTransactionExecutor } from '../../src/infrastructure/SolanaTransactionExecutor';
import * as dotenv from 'dotenv';

dotenv.config();

describe('EnclaveService E2E (Asynchronous Attestation)', () => {
    let connection: Connection;
    let oracle: MockAttestationOracle;
    let executor: SolanaTransactionExecutor;
    let service: EnclaveService;

    const policy: PolicyRuleset = {
        maxTradeSol: 0.05,
        allowedDestinations: ["4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k"]
    };

    beforeAll(() => {
        // Use Helius Devnet if available, else fallback to public devnet
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        connection = new Connection(rpcUrl, 'confirmed');
        oracle = new MockAttestationOracle();
        executor = new SolanaTransactionExecutor(connection);
        service = new EnclaveService(policy, oracle, executor);
    });

    it('1. Happy Path: Boots, Attests, and executes a zero-latency trade on Devnet', async () => {
        // Boot the TEE (Asynchronous Attestation)
        await service.boot();
        
        // Assert the oracle whitelisted the key
        expect(service.isAttested()).toBe(true);

        // Execute valid trade
        const validIntent = TradeIntent.create({
            destination: "4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k",
            amountSol: 0.000001
        });

        const txSig = await service.execute(validIntent);
        
        // Ensure we got a real Solana transaction signature back
        expect(txSig).toBeDefined();
        expect(typeof txSig).toBe('string');
        expect(txSig.length).toBeGreaterThan(64); // Signatures are ~88 chars
    }, 30000); // 30 second timeout for network call

    it('2. Policy Rejection: Blocks trades exceeding budget without touching the network', async () => {
        // Enclave should already be booted from the previous test
        const maliciousIntent = TradeIntent.create({
            destination: "4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k",
            amountSol: 1.5 // Max is 0.05
        });

        await expect(service.execute(maliciousIntent)).rejects.toThrow(/POLICY DENIED/);
    });

    it('3. RPC Failure: Gracefully handles malformed Solana requests', async () => {
        // Create an intent with a destination that is syntactically invalid 
        // to force an execution failure from the Solana SDK.
        const invalidAddressIntent = TradeIntent.create({
            destination: "invalid_solana_address_123",
            amountSol: 0.01
        });

        await expect(service.execute(invalidAddressIntent)).rejects.toThrow();
    });

    it('4. Attestation Failure: Blocks execution if Switchboard rejects the quote', async () => {
        const strictOracle = new MockAttestationOracle();
        // Force the oracle to reject the quote by overriding the method
        vi.spyOn(strictOracle, 'submitQuote').mockResolvedValue(false);
        vi.spyOn(strictOracle, 'isWhitelisted').mockResolvedValue(false);

        const strictService = new EnclaveService(policy, strictOracle, executor);
        
        // The boot should technically complete, but set attested = false
        await strictService.boot();
        expect(strictService.isAttested()).toBe(false);

        const validIntent = TradeIntent.create({
            destination: "4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k",
            amountSol: 0.01
        });

        // The execute call must fail because the session key was not whitelisted
        await expect(strictService.execute(validIntent)).rejects.toThrow(/Enclave is not attested/);
    });
});
