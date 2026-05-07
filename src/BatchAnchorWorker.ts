import { AegisJournal } from './infrastructure/AegisJournal';
import { ILedgerAnchor } from './ports/ILedgerAnchor';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { AegisComplianceReceipt } from './types';

export class BatchAnchorWorker {
    private journal: AegisJournal;
    private anchor: ILedgerAnchor;
    private enclaveDid: string;
    private intervalId: NodeJS.Timeout | null = null;
    private isAnchoring: boolean = false;

    private pep: any; // Injected to update evidence store

    constructor(journal: AegisJournal, anchor: ILedgerAnchor, enclaveDid: string, pep: any) {
        this.journal = journal;
        this.anchor = anchor;
        this.enclaveDid = enclaveDid;
        this.pep = pep;
    }

    public start(intervalMs: number = 2000) {
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

    private buildMerkleRoot(unbatched: any[]): string {
        const leaves = unbatched.map(entry => {
            const hexString = entry.article12LogHash.replace(/^0x/, '');
            return keccak256(Buffer.from(hexString, 'hex'));
        });
        const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        return '0x' + tree.getRoot().toString('hex');
    }

    private createBatchReceipt(merkleRoot: string, length: number): AegisComplianceReceipt {
        const batchActionId = `batch-${Date.now()}-${length}`;
        return {
            receiptId: batchActionId,
            actionId: batchActionId,
            payloadHash: merkleRoot,
            timestamp: new Date().toISOString(),
            isBatch: true,
            count: length
        } as unknown as AegisComplianceReceipt;
    }

    private async performAnchor(batchReceipt: AegisComplianceReceipt): Promise<any> {
        const anchorPromise = this.anchor.anchorReceipt(batchReceipt, 'approved', this.enclaveDid);
        const timeoutPromise = new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('RPC connection timed out after 120000ms')), 120000)
        );
        return Promise.race([anchorPromise, timeoutPromise]);
    }

    private async saveSingleEvidence(entry: any, ledgerReceipt: any) {
        try {
            const original = await this.pep.getEvidenceByReceiptId(entry.receiptId);
            if (!original) return;
            const blockTime = ledgerReceipt.blockTime || undefined;
            await this.pep.saveEvidence(original, ledgerReceipt.txSignature, blockTime);
        } catch (err: any) {
            console.error(`[BatchAnchorWorker] Failed to update evidence for ${entry.receiptId}: ${err.message}`);
        }
    }

    private async updateEvidenceStore(unbatched: any[], ledgerReceipt: any) {
        for (const entry of unbatched) {
            await this.saveSingleEvidence(entry, ledgerReceipt);
        }
        this.journal.markAsBatched(unbatched.map(entry => entry.nonce));
    }

    private async executeAnchorCycle(unbatched: any[]) {
        console.log(`[BatchAnchorWorker] Sweeping ${unbatched.length} receipts...`);
        const merkleRoot = this.buildMerkleRoot(unbatched);
        const batchReceipt = this.createBatchReceipt(merkleRoot, unbatched.length);
        const ledgerReceipt = await this.performAnchor(batchReceipt);
        
        const sig = ledgerReceipt ? ledgerReceipt.txSignature : null;
        if (sig) {
            console.log(`[BatchAnchorWorker] Anchored root ${merkleRoot} in ${sig}`);
            await this.updateEvidenceStore(unbatched, ledgerReceipt);
        }
    }

    private async processBatch() {
        if (this.isAnchoring) return;
        const unbatched = this.journal.getUnbatchedEntries();
        if (unbatched.length === 0) return;
        
        this.isAnchoring = true;
        try {
            await this.executeAnchorCycle(unbatched);
        } catch (e: any) {
            console.error(`[BatchAnchorWorker] Failed to anchor batch: ${e.message}`);
        } finally {
            this.isAnchoring = false;
        }
    }
}
