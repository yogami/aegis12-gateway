import { AegisComplianceReceipt } from '../types';
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import * as sqds from '@sqds/multisig';
import * as dotenv from 'dotenv';

dotenv.config();

// We need an instruction to put inside the proposal.
// We'll create a dummy instruction or a memo instruction representing the TEE evidence payload.
import { createMemoInstruction } from '@solana/spl-memo';

/**
 * Squads V4 Router
 * 
 * Routes high-risk agent intents to the DAO's Squads Multisig.
 * If the TEE evaluates a transaction and decides to 'escalate', this router
 * intercepts the receipt and creates a Draft Proposal on-chain.
 */
export class SquadsRouter {
    /**
     * Inspects a compliance receipt and routes it to Squads if escalated.
     * @param receipt The final compliance receipt from the Aegis TEE
     */
    public static async routeIfEscalated(
        receipt: AegisComplianceReceipt,
        testConnection?: Connection,
        testPayer?: Keypair
    ): Promise<{ txSignature: string, proposalPda: string } | void> {
        if (receipt.decision !== 'escalated' || !receipt.envelope) {
            // Intent is within autonomous bounds. Allow direct execution.
            return;
        }

        console.log(`[Aegis-12] ⚠️ HIGH RISK INTENT DETECTED. Routing to Squads V4 Multisig...`);
        console.log(`[Aegis-12] Target Vault: ${receipt.envelope.vault_pda}`);
        
        return await this.createMultisigProposal(receipt, testConnection, testPayer);
    }

    /**
     * Resolves connection and payer keypair from env or test overrides.
     */
    private static resolveConnectionAndPayer(
        testConnection?: Connection,
        testPayer?: Keypair
    ): { connection: Connection; payer: Keypair } {
        const rpcUrl = process.env.SOLANA_RPC_URL
            || 'https://devnet.helius-rpc.com/?api-key=e3f686d4-1710-4a8e-a2f4-4f147052af29';
        const connection = testConnection || new Connection(rpcUrl, 'confirmed');

        if (testPayer) return { connection, payer: testPayer };

        const secretBase64 = process.env.SOLANA_PAYER_SECRET;
        if (!secretBase64) throw new Error("SOLANA_PAYER_SECRET is not configured for SquadsRouter");
        return { connection, payer: Keypair.fromSecretKey(Buffer.from(secretBase64, 'base64')) };
    }

    /**
     * Creates a Squads V4 Vault Transaction anchoring an escalation memo.
     */
    private static async createVaultTransaction(
        connection: Connection,
        payer: Keypair,
        multisigPda: PublicKey,
        txIndex: bigint,
        receiptId: string
    ): Promise<string> {
        const memoStr = `Aegis-12 Escalation ID: ${receiptId}`;
        const instruction = createMemoInstruction(memoStr, [payer.publicKey]);
        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        const transactionMessage = new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: [instruction]
        });

        const txSig = await sqds.rpc.vaultTransactionCreate({
            connection, feePayer: payer, multisigPda,
            transactionIndex: txIndex, creator: payer.publicKey,
            vaultIndex: 0, ephemeralSigners: 0, transactionMessage,
            memo: "Aegis-12 Vault Transaction",
            sendOptions: { skipPreflight: true }
        });

        const txRes = await connection.confirmTransaction({
            signature: txSig,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, 'confirmed');
        if (txRes.value.err) {
            console.error(`[Aegis-12] Vault Transaction creation failed:`, txRes.value.err);
            throw new Error(`Vault Transaction failed: ${JSON.stringify(txRes.value.err)}`);
        }
        return txSig;
    }

    /**
     * Creates and confirms a Squads V4 Proposal for the given transaction index.
     */
    private static async createProposal(
        connection: Connection,
        payer: Keypair,
        multisigPda: PublicKey,
        txIndex: bigint
    ): Promise<{ signature: string; proposalPda: PublicKey }> {
        const [proposalPda] = sqds.getProposalPda({ multisigPda, transactionIndex: txIndex });

        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        const signature = await sqds.rpc.proposalCreate({
            connection, creator: payer, multisigPda,
            transactionIndex: txIndex, feePayer: payer,
            sendOptions: { skipPreflight: true }
        });

        const res = await connection.confirmTransaction({
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, 'confirmed');
        if (res.value.err) {
            console.error(`[Aegis-12] Proposal creation failed on-chain:`, res.value.err);
            throw new Error(`Proposal creation failed: ${JSON.stringify(res.value.err)}`);
        }
        return { signature, proposalPda };
    }

    /**
     * Orchestrates the full Squads V4 proposal lifecycle for an escalated intent.
     */
    private static async createMultisigProposal(
        receipt: AegisComplianceReceipt,
        testConnection?: Connection,
        testPayer?: Keypair
    ): Promise<{ txSignature: string, proposalPda: string }> {
        const { connection, payer } = this.resolveConnectionAndPayer(testConnection, testPayer);
        const multisigPda = new PublicKey(receipt.envelope!.vault_pda);

        const multisigAccount = await sqds.generated.Multisig.fromAccountAddress(connection, multisigPda);
        const txIndex = BigInt(multisigAccount.transactionIndex.toString()) + 1n;

        await this.createVaultTransaction(connection, payer, multisigPda, txIndex, receipt.receiptId);
        const { signature, proposalPda } = await this.createProposal(connection, payer, multisigPda, txIndex);

        (receipt as any).squadsProposalId = proposalPda.toBase58();
        console.log(`[Aegis-12] ✅ Squads Proposal Created: ${proposalPda.toBase58()}`);
        console.log(`[Aegis-12] Human signers must now approve this transaction via the Squads UI.`);

        return { txSignature: signature, proposalPda: proposalPda.toBase58() };
    }
}
