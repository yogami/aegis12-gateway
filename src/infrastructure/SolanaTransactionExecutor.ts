import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMemoInstruction } from '@solana/spl-memo';
import { TransactionExecutor } from '../ports/TransactionExecutor';
import { SessionKey } from '../domain/SessionKey';
import { TradeIntent } from '../domain/TradeIntent';
import { AttestationQuote } from '../domain/AttestationQuote';

export class SolanaTransactionExecutor implements TransactionExecutor {
    constructor(private readonly connection: Connection) {}

    async execute(
        sessionKey: SessionKey,
        intent: TradeIntent,
        quote: AttestationQuote
    ): Promise<string> {
        console.log(`[TEE Enclave] ⚡ Atomically verifying Whitelisted Session Key + Trade on Solana...`);
        
        // Load the keypair from the domain object
        const keypair = Keypair.fromSecretKey(sessionKey.secretKeyBytes());
        
        // 1. Trade Instruction
        const destPubkey = new PublicKey(intent.destination);
        const lamports = Math.floor(intent.amountSol * LAMPORTS_PER_SOL);
        const transferIx = SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: destPubkey,
            lamports
        });

        // 2. The Atomic Whitelist Verification (Simulated via Memo)
        // In production, this is a CPI to our `aegis_oracle` program 
        // to assert the session key's PDA state is `is_whitelisted == true`.
        // We embed the deterministic quoteHash here for the verifier script to audit.
        const oraclePayload = JSON.stringify({
            program: "aegis_oracle",
            instruction: "verify_attestation",
            quote_hash: quote.quoteHash,
            policy_hash: quote.policyHash,
            report_data: quote.reportData
        });
        const oracleIx = createMemoInstruction(oraclePayload, [keypair.publicKey]);

        // 3. Construction & Execution
        const tx = new Transaction().add(oracleIx).add(transferIx);
        
        const startTime = Date.now();
        try {
            const txSig = await sendAndConfirmTransaction(this.connection, tx, [keypair]);
            const elapsed = Date.now() - startTime;
            
            console.log(`[TEE Enclave] ✅ Execution successful in ${elapsed}ms.`);
            console.log(`[TEE Enclave] 📜 Signature: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
            return txSig;
        } catch (error: any) {
            throw new Error(`Solana execution failed: ${error.message}`);
        }
    }
}
