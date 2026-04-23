import { AegisJournal } from './infrastructure/AegisJournal';
import { SolanaAnchor } from './infrastructure/SolanaAnchor';
import { createHash } from 'crypto';

export class BatchAnchorWorker {
    private journal: AegisJournal;
    private anchor: SolanaAnchor;
    private enclaveDid: string;
    private intervalId: NodeJS.Timeout | null = null;
    private isAnchoring: boolean = false;

    constructor(journal: AegisJournal, anchor: SolanaAnchor, enclaveDid: string) {
        this.journal = journal;
        this.anchor = anchor;
        this.enclaveDid = enclaveDid;
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
            
            // Compute Merkle Root (simplified flat hash for hackathon)
            const hashes = unbatched.map(entry => entry.article12LogHash).sort();
            const merkleRoot = createHash('sha512').update(hashes.join(',')).digest('hex');

            const batchActionId = `batch-${Date.now()}-${unbatched.length}`;
            
            // Create a synthetic receipt that represents the batch
            const batchReceipt = {
                receiptId: batchActionId,
                actionId: batchActionId,
                payloadHash: merkleRoot, // The anchor will use this
                timestamp: new Date().toISOString(),
                isBatch: true,
                count: unbatched.length
            };

            const solanaReceipt = await this.anchor.anchorReceipt(batchReceipt, 'approved', this.enclaveDid);

            if (solanaReceipt && solanaReceipt.txSignature) {
                console.log(`[BatchAnchorWorker] Successfully anchored batch root ${merkleRoot} in tx ${solanaReceipt.txSignature}`);
                
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
