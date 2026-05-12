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
        
        const keypair = Keypair.fromSecretKey(sessionKey.secretKeyBytes());
        const tx = this.buildTransaction(keypair, intent, quote);
        
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

    async simulate(
        sessionKey: SessionKey,
        intent: TradeIntent,
        quote: AttestationQuote
    ): Promise<{ success: boolean; error?: string; logs?: string[] }> {
        const keypair = Keypair.fromSecretKey(sessionKey.secretKeyBytes());
        const tx = this.buildTransaction(keypair, intent, quote);
        
        const simulation = await this.connection.simulateTransaction(tx, [keypair]);
        
        if (simulation.value.err) {
            return {
                success: false,
                error: JSON.stringify(simulation.value.err),
                logs: simulation.value.logs ?? []
            };
        }

        return { success: true, logs: simulation.value.logs ?? [] };
    }

    private buildTransaction(keypair: Keypair, intent: TradeIntent, quote: AttestationQuote): Transaction {
        const destPubkey = new PublicKey(intent.destination);
        const lamports = Math.floor(intent.amountSol * LAMPORTS_PER_SOL);
        const transferIx = SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: destPubkey,
            lamports
        });

        const oraclePayload = JSON.stringify({
            program: "aegis_oracle",
            instruction: "verify_attestation",
            quote_hash: quote.quoteHash,
            policy_hash: quote.policyHash,
            report_data: quote.reportData
        });
        const oracleIx = createMemoInstruction(oraclePayload, [keypair.publicKey]);

        return new Transaction().add(oracleIx).add(transferIx);
    }
}
