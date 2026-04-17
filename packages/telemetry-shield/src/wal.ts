import { AgentEvidenceRecord, ITeeAnchor } from "./types";

export interface QueuedEvidence {
    id: string;
    record: AgentEvidenceRecord;
}

export class EvidenceWAL {
    // Hard boundary to prevent Out Of Memory (OOM) leaks during massive HFT traffic spikes or TEE partition.
    private readonly MAX_QUEUE_SIZE = 5000;
    
    private readonly walPath = ".aegis_wal.json";
    private readonly inMemoryQueue: Map<string, QueuedEvidence> = new Map();
    private isNode: boolean;
    
    private isSyncing = false;
    private writeQueued = false;
    private evictedCount = 0;

    constructor() {
        this.isNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null;
    }

    private async getFs() {
        if (!this.isNode) return null;
        try {
            return await import("fs/promises");
        } catch {
            return null;
        }
    }

    private async syncToDisk() {
        if (!this.isNode) return;
        
        // Asynchronous File-System Mutex Check
        if (this.isSyncing) {
            this.writeQueued = true;
            return;
        }
        
        this.isSyncing = true;
        this.writeQueued = false;

        const fs = await this.getFs();
        if (fs) {
            try {
                const data = JSON.stringify(Array.from(this.inMemoryQueue.entries()));
                const tempPath = `${this.walPath}.tmp`;
                await fs.writeFile(tempPath, data, "utf-8");
                await fs.rename(tempPath, this.walPath);
            } catch (e) {
                // Fail gracefully without crashing the trading loop
            }
        }

        this.isSyncing = false;
        
        // Flush again if incoming traces arrived while the OS locked the file
        if (this.writeQueued) {
            this.syncToDisk().catch(() => {});
        }
    }

    /**
     * Secures the log in the WAL prior to network dispatch.
     * Incorporates protective OOM capping via strict FIFO ejection.
     */
    public async storeIntent(record: AgentEvidenceRecord): Promise<string> {
        // Protective OOM Cap: Prevent node from blowing up memory during network disconnection
        if (this.inMemoryQueue.size >= this.MAX_QUEUE_SIZE) {
            // Primitive FIFO: Drop oldest trace to secure active memory thread
            const oldestKey = this.inMemoryQueue.keys().next().value;
            if (oldestKey) this.inMemoryQueue.delete(oldestKey);
            this.evictedCount++;
            if (this.evictedCount % 1000 === 1) {
                console.warn(`[Aegis-12 WAL] Severe Network Degration: Memory Overflow Prevented. Oldest Trace Evicted.`);
            }
        }

        const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7);
        this.inMemoryQueue.set(id, { id, record });
        
        await this.syncToDisk();
        return id;
    }

    /**
     * Removes the log from the WAL after a verifiable 200 OK from the Decentralized TEE.
     */
    public async removeIntent(id: string): Promise<void> {
        if (this.inMemoryQueue.has(id)) {
            this.inMemoryQueue.delete(id);
            await this.syncToDisk();
        }
    }

    /**
     * Initializes the WAL on boot, scanning for stranded payloads due to a prior crash.
     * Fires them back through the TEE integration array.
     */
    public async flushQueue(anchors: ITeeAnchor[]): Promise<void> {
        if (anchors.length === 0) return;
        
        if (this.isNode) {
            const fs = await this.getFs();
            if (fs) {
                try {
                    const data = await fs.readFile(this.walPath, "utf-8");
                    const parsed: [string, QueuedEvidence][] = JSON.parse(data);
                    for (const [key, val] of parsed) {
                        this.inMemoryQueue.set(key, val);
                    }
                } catch {
                    // File may not exist yet, totally fine.
                }
            }
        }

        if (this.inMemoryQueue.size > 0) {
            console.log(`[Aegis-12 WAL] Discovered ${this.inMemoryQueue.size} stranded evidence records. Re-transmitting...`);
            for (const [id, queued] of this.inMemoryQueue.entries()) {
                anchors.forEach(anchor => {
                    anchor.submitEvidence(queued.record).then(() => {
                        this.removeIntent(id).catch(() => {});
                    }).catch(err => {
                        console.warn(`[Aegis-12 WAL] Background TEE Sync Failure: ${err}`);
                    });
                });
            }
        }
    }
}
