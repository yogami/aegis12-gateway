import { AegisJournal } from './infrastructure/AegisJournal';
import { SolanaAnchor } from './infrastructure/SolanaAnchor';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export class BatchAnchorWorker {
    private journal: AegisJournal;
    private anchor: SolanaAnchor;
    private enclaveDid: string;
    private intervalId: NodeJS.Timeout | null = null;
    private isAnchoring: boolean = false;

    private pep: any; // Injected to update evidence store

    constructor(journal: AegisJournal, anchor: SolanaAnchor, enclaveDid: string, pep: any) {
        this.journal = journal;
        this.anchor = anchor;
        this.enclaveDid = enclaveDid;
        this.pep = pep;
    }

    public start(intervalMs: number = 30000) {
        if (this.intervalId) return;
        
        console.log(`[BatchAnchorWorker] Starting worker with interval ${intervalMs}ms`);
        this.intervalId = setInterval(() => this.processBatch(), intervalMs);
        
        // Execute an initial sweep
        this.processBatch().catch(err => console.error(`[BatchAnchorWorker] Initial batch error: ${err.message}`));
    }

    public stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[BatchAnchorWorker] Stopped');
        }
    }

    private async processBatch() {
        if (this.isAnchoring) return;
        
        const unbatched = this.journal.getUnbatchedEntries();
        if (unbatched.length === 0) {
            return;
        }

        this.isAnchoring = true;

        try {
            console.log(`[BatchAnchorWorker] Sweeping ${unbatched.length} unanchored receipts...`);
            
            // Compute real Merkle Root (proper Buffer encoding for keccak256)
            const leaves = unbatched.map(entry => {
                const hexString = entry.article12LogHash.replace(/^0x/, '');
                return keccak256(Buffer.from(hexString, 'hex'));
            });
            const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
            const merkleRoot = '0x' + tree.getRoot().toString('hex');

            const batchActionId = `batch-${Date.now()}-${unbatched.length}`;
            
            const batchReceipt = {
                receiptId: batchActionId,
                actionId: batchActionId,
                payloadHash: merkleRoot,
                timestamp: new Date().toISOString(),
                isBatch: true,
                count: unbatched.length
            };

            const anchorPromise = this.anchor.anchorReceipt(batchReceipt, 'approved', this.enclaveDid);
            
            // Fix: Enforce a generous 120-second timeout on the Solana RPC call.
            // Devnet confirmations frequently exceed 15s, which previously caused infinite batching loops.
            const timeoutPromise = new Promise<any>((_, reject) => 
                setTimeout(() => reject(new Error('RPC connection timed out after 120000ms')), 120000)
            );
            
            const solanaReceipt = await Promise.race([anchorPromise, timeoutPromise]);

            if (solanaReceipt && solanaReceipt.txSignature) {
                console.log(`[BatchAnchorWorker] Successfully anchored batch root ${merkleRoot} in tx ${solanaReceipt.txSignature}`);
                
                // Update evidence store for each individual receipt in the batch
                for (const entry of unbatched) {
                    try {
                        const original = await this.pep.getEvidenceByReceiptId(entry.receiptId);
                        if (original) {
                            await this.pep.saveEvidence(original, solanaReceipt.txSignature);
                        }
                    } catch (err: any) {
                        console.error(`[BatchAnchorWorker] Failed to update evidence for ${entry.receiptId}: ${err.message}`);
                    }
                }

                const nonces = unbatched.map(entry => entry.nonce);
                this.journal.markAsBatched(nonces);
            }
        } catch (e: any) {
            console.error(`[BatchAnchorWorker] Failed to anchor batch: ${e.message}`);
        } finally {
            this.isAnchoring = false;
        }
    }
}
