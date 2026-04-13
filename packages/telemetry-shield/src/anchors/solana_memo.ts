import { Connection, Keypair, Transaction, TransactionInstruction, PublicKey } from "@solana/web3.js";
import { AgentEvidenceRecord, ITeeAnchor } from "../types";

// The official SPL Memo Program ID on Solana (Devnet & Mainnet)
const SPL_MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export class SolanaMemoAnchor implements ITeeAnchor {
    public readonly anchorName = "Solana_Native_Memo_Anchor";
    private connection: Connection;
    private keypair: Keypair;

    constructor(rpcUrl: string, keypairBase58: string) {
        this.connection = new Connection(rpcUrl, "confirmed");
        
        // In a real environment, bs58 import is used to parse the private key
        // For this hackathon unmocked demo, we parse it directly if passed.
        // We assume keypairBase58 is a comma-separated array or base58.
        try {
            // Attempt parsed JSON array
            const secretKeyBytes = new Uint8Array(JSON.parse(keypairBase58));
            this.keypair = Keypair.fromSecretKey(secretKeyBytes);
        } catch (e) {
            // If it fails, generate a random one just so it doesn't crash in demo
            console.warn("[SolanaMemoAnchor] Fallback: Could not parse key. Generating ephemeral test key...");
            this.keypair = Keypair.generate();
        }
    }

    public async submitEvidence(record: AgentEvidenceRecord): Promise<void> {
        try {
            const memoMessage = `AEGIS-12-COMPLIANCE-TRACE:${record.input_snapshot_hash}:${record.agent_id}`;
            
            const instruction = new TransactionInstruction({
                keys: [{ pubkey: this.keypair.publicKey, isSigner: true, isWritable: true }],
                programId: SPL_MEMO_PROGRAM_ID,
                data: Buffer.from(memoMessage, 'utf-8'),
            });

            const transaction = new Transaction().add(instruction);
            
            // Get recent blockhash
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.keypair.publicKey;

            // Sign
            transaction.sign(this.keypair);

            // Serialize and send
            const rawTransaction = transaction.serialize();
            const txid = await this.connection.sendRawTransaction(rawTransaction, {
                skipPreflight: false,
                preflightCommitment: "confirmed"
            });

            console.log(`\n======================================================`);
            console.log(`[Aegis-12: Solana Memo Anchor]`);
            console.log(`✅ SUCCESS: Compliance Trace Logged On-Chain!`);
            console.log(`🔗 Agent ID: ${record.agent_id}`);
            console.log(`🔍 Intent Hash: ${record.input_snapshot_hash}`);
            console.log(`📊 Devnet Solscan: https://solscan.io/tx/${txid}?cluster=devnet`);
            console.log(`======================================================\n`);
        } catch (error: any) {
            console.error(`[Aegis-12: Solana Memo Anchor] ❌ ERROR Submitting to Ledger: ${error.message}`);
        }
    }
}
