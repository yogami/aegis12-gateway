import { describe, it, expect, beforeAll } from 'vitest';
import { Connection, PublicKey } from '@solana/web3.js';
import { EnclaveService } from '../../src/application/EnclaveService';
import { MockAttestationOracle } from '../../src/infrastructure/MockAttestationOracle';
import { SolanaTransactionExecutor } from '../../src/infrastructure/SolanaTransactionExecutor';
import { TradeIntent } from '../../src/domain/TradeIntent';
import dotenv from 'dotenv';

dotenv.config();

/**
 * ATDD Spec: Attestation Substance Verification (Article 12)
 * 
 * Acceptance Criteria:
 * AC-1: The Gateway must execute a live transaction on Solana.
 * AC-2: We must query the live blockchain to fetch the transaction.
 * AC-3: The transaction's embedded Memo instruction must mathematically prove
 *       that the exact Switchboard Attestation Hash was anchored on-chain.
 */
describe('Attestation Substance Verification (Article 12)', () => {
    let enclave: EnclaveService;
    let rpcConnection: Connection;
    let txSig: string;
    let expectedHardwareHash: string;

    beforeAll(async () => {
        const ruleset = {
            maxTradeSol: 0.05,
            allowedDestinations: ['4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k']
        };

        rpcConnection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');

        const oracle = new MockAttestationOracle();
        const executor = new SolanaTransactionExecutor(rpcConnection);

        enclave = new EnclaveService(ruleset, oracle, executor);
        await enclave.boot();

        // Capture the internal quote hash that we EXPECT to be embedded in the blockchain
        expectedHardwareHash = (enclave as any).quote.quoteHash;
    });

    it('should execute a real trade and verify the cryptographic substance on-chain', async () => {
        // AC-1: Execute the live transaction
        const intent = TradeIntent.create({
            destination: '4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k',
            amountSol: 0.001
        });

        console.log(`[Substance Test] Executing intent: ${intent.amountSol} SOL`);
        txSig = await enclave.execute(intent);
        
        expect(txSig).toBeDefined();
        expect(txSig.length).toBeGreaterThan(64);
        console.log(`[Substance Test] Transaction finalized: ${txSig}`);

        // AC-2: Query the live blockchain
        const txData = await rpcConnection.getParsedTransaction(txSig, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });

        expect(txData).not.toBeNull();

        // AC-3: Verify the cryptographic memo
        const instructions = txData!.transaction.message.instructions;
        
        // Find the SPL Memo instruction
        const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr").toBase58();
        const memoInstruction = instructions.find((ix: any) => ix.programId.toBase58() === memoProgramId);

        expect(memoInstruction).toBeDefined();

        const parsedMemoString = (memoInstruction as any).parsed;
        const memoPayload = JSON.parse(parsedMemoString);
        
        expect(memoPayload.program).toBe('aegis_oracle');
        expect(memoPayload.quote_hash).toBe(expectedHardwareHash);
        
        console.log(`[Substance Test] ✅ Successfully verified on-chain cryptographic substance!`);
    }, 45000); // 45 seconds for Devnet confirmation
});
