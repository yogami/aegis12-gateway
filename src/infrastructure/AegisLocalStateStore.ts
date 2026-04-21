import { IAegisStateStore, BehavioralStats } from '../ports/IAegisStateStore';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { WALEngine } from './WALEngine';
export class AegisLocalStateStore implements IAegisStateStore {
    private state: Map<string, BehavioralStats> = new Map();
    private evidence: Map<string, any> = new Map();
    private walPath: string;
    private evidencePath: string;
    private lockPath: string;
    private walEngine: WALEngine;

    constructor(walPath: string = '.aegis_state.json') {
        this.walPath = path.resolve(process.cwd(), walPath);
        this.evidencePath = path.resolve(process.cwd(), '.aegis_evidence.json');
        this.lockPath = `${this.walPath}.lock`;
        this.walEngine = new WALEngine("aegis-12/wal-state-encryption-key");
    }

    public async initialize(): Promise<void> {
        await this.walEngine.initialize();
        this.load();
    }

    private load() {
        // Load Behavioral Stats
        const statsDecrypted = this.walEngine.loadWalSync(this.walPath);
        if (statsDecrypted) {
            const data = JSON.parse(statsDecrypted);
            Object.keys(data).forEach(k => this.state.set(k, data[k]));
        }

        // Load Evidence Ledger
        const evidenceDecrypted = this.walEngine.loadWalSync(this.evidencePath);
        if (evidenceDecrypted) {
            const data = JSON.parse(evidenceDecrypted);
            Object.keys(data).forEach(k => this.evidence.set(k, data[k]));
        }
    }

    private async persist() {
        await this.walEngine.acquireLock(this.lockPath);
        try {
            // Persist Stats
            const statsData = Object.fromEntries(this.state);
            this.walEngine.atomicWriteSync(`${this.walPath}.tmp`, this.walPath, JSON.stringify(statsData));

            // Persist Evidence
            const evidenceData = Object.fromEntries(this.evidence);
            this.walEngine.atomicWriteSync(`${this.evidencePath}.tmp`, this.evidencePath, JSON.stringify(evidenceData));
        } finally {
            this.walEngine.releaseLock(this.lockPath);
        }
    }

    public async getStats(agentId: string): Promise<BehavioralStats> {
        return this.state.get(agentId) || {
            totalSpend: 0,
            actionCount: 0,
            lastActionTimestamp: 0,
            velocityScore: 0
        };
    }

    public async updateStats(agentId: string, deltaSpend: number): Promise<BehavioralStats> {
        const current = await this.getStats(agentId);
        const updated: BehavioralStats = {
            totalSpend: current.totalSpend + deltaSpend,
            actionCount: current.actionCount + 1,
            lastActionTimestamp: Date.now(),
            velocityScore: current.velocityScore + 1
        };
        this.state.set(agentId, updated);
        await this.persist();
        return updated;
    }

    public async saveEvidence(receipt: any, solanaTx?: string): Promise<void> {
        const key = solanaTx || receipt.actionId || receipt.receiptId;
        this.evidence.set(key, receipt);
        await this.persist();
    }

    public async getEvidence(txSignature: string): Promise<any | null> {
        return this.evidence.get(txSignature) || null;
    }

    public async getEvidenceByReceiptId(receiptId: string): Promise<any | null> {
        for (const v of this.evidence.values()) {
            if (v.receiptId === receiptId) {
                return v;
            }
        }
        return null;
    }

    public async updateZkSeal(receiptId: string, zkSealData: { seal?: string, vkey?: string }): Promise<void> {
        let foundKey: string | null = null;
        for (const [k, v] of this.evidence.entries()) {
            if (v.receiptId === receiptId) {
                foundKey = k;
                break;
            }
        }
        if (foundKey) {
            const receipt = this.evidence.get(foundKey);
            receipt.ars_anchor = zkSealData.seal;
            receipt.zk_vkey = zkSealData.vkey;
            this.evidence.set(foundKey, receipt);
            await this.persist();
        }
    }

    public async updateBatchProof(batchId: string, merkleRoot: string, pqSignature: string, proofs: Record<string, string[]>): Promise<void> {
        let updated = false;
        for (const [k, v] of this.evidence.entries()) {
            const nonce = v.authorizationNonce;
            if (proofs[nonce]) {
                v.batchProof = {
                    batchId,
                    merkleRoot,
                    pqSignature,
                    proofPath: proofs[nonce]
                };
                this.evidence.set(k, v);
                updated = true;
            }
        }
        if (updated) {
            await this.persist();
        }
    }

    public async checkpoint(): Promise<void> {
        await this.persist();
    }
}
