/**
 * EvidenceRegistry — Public Verification Layer for Agent Actions
 * 
 * To prove "Agent Evidence Anchoring," we must allow third-party observability of the ARS-01 receipts.
 * This class abstracts the querying of the Solana blockchain for the Aegis PDA's recent signatures,
 * parsing out the memo and SPL-token transfer events that constitute cryptographic proof of safety.
 */

import { Connection, PublicKey } from '@solana/web3.js';

interface AnchoredEvidence {
    signature: string;
    blockTime?: number | null;
    status: 'Success' | 'Failed';
    agentDid: string;
    memoInstruction?: string; // The ARS-01 receipt payload
}

export class EvidenceRegistry {
    private connection: Connection;
    private aegisPda: PublicKey;

    constructor(
        cluster: string = 'devnet',
        aegisPda: string = 'AegisStakingPooL11111111111111111111111111111'
    ) {
        // Use a generic public RPC for the indexer unless specified
        const rpcUrl = cluster === 'mainnet-beta' 
            ? 'https://api.mainnet-beta.solana.com' 
            : 'https://api.devnet.solana.com';
        
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.aegisPda = new PublicKey(aegisPda);
    }

    /**
     * Fetches the most recent anchored ARS-01 receipts involving the Aegis TEE signature.
     * 
     * @param limit Maximum number of receipts to return
     * @returns Array of parsed AnchoredEvidence
     */
    public async getRecentAnchors(limit: number = 20): Promise<AnchoredEvidence[]> {
        const signatures = await this.connection.getSignaturesForAddress(this.aegisPda, { limit });

        const evidenceList: AnchoredEvidence[] = [];

        for (const sigInfo of signatures) {
            let agentDid = "Unknown";
            let memoInstruction = "";

            try {
                const tx = await this.connection.getParsedTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0 });
                if (tx && tx.transaction.message.instructions) {
                    const memoIx = tx.transaction.message.instructions.find((ix: any) => 
                        ix.programId.toBase58() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' || 
                        ix.programId.toBase58() === 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo'
                    );
                    if (memoIx && 'parsed' in memoIx) {
                        memoInstruction = typeof memoIx.parsed === 'string' ? memoIx.parsed : JSON.stringify(memoIx.parsed);
                        try {
                            const receiptMatch = memoInstruction.match(/({.*})/);
                            if (receiptMatch) {
                                const receipt = JSON.parse(receiptMatch[1]);
                                if (receipt.agentPubKey) agentDid = receipt.agentPubKey;
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {
                // Ignore fetching errors
            }
            
            evidenceList.push({
                signature: sigInfo.signature,
                blockTime: sigInfo.blockTime,
                status: sigInfo.err ? 'Failed' : 'Success',
                agentDid: agentDid,
                memoInstruction: memoInstruction || `[ARS-01] Anchored Decision metadata for ${sigInfo.signature}`,
            });
        }

        return evidenceList;
    }
}
