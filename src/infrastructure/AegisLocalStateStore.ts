import { IAegisStateStore, BehavioralStats } from '../ports/IAegisStateStore';
import { AegisComplianceReceipt } from '../types';
import { WALEngine } from './WALEngine';
import { TerminalRefusalError } from '../errors';
import { JsonUtils } from './JsonUtils';

/**
 * [WORLD CLASS HARDENING] Secure Local State Store
 * Implements hardware-bound encryption and structural validation.
 */
export class AegisLocalStateStore implements IAegisStateStore {
    private walEngine: WALEngine;
    private state: Map<string, BehavioralStats> = new Map();
    private evidence: Map<string, any> = new Map();
    private evidenceByReceipt: Map<string, string> = new Map(); // receiptId -> ledger_tx
    private walPath: string;
    private evidencePath: string;

    constructor(dataDir: string = '/var/data', walKey?: string) {
        const secret = walKey || process.env.WAL_SECRET;
        if (!secret && process.env.NODE_ENV !== 'test') {
            throw new TerminalRefusalError('[TERMINAL REFUSAL] WAL_SECRET mandatory in production.');
        }
        this.walEngine = new WALEngine(secret || "default-unsafe-dev-key");
        this.walPath = `${dataDir}/tenant_stats.wal`;
        this.evidencePath = `${dataDir}/evidence_store.wal`;
    }

    public async initialize(): Promise<void> {
        await this.walEngine.initialize();
        await this.load();
    }

    private async load(): Promise<void> {
        this.loadState();
        this.loadEvidence();
    }

    private loadState(): void {
        const raw = this.walEngine.loadWalSync(this.walPath);
        if (!raw) return;
        const data = JsonUtils.safeParse(raw, 'StateStore');
        Object.keys(data).forEach(k => {
            const s = data[k];
            if (typeof s?.totalSpend === 'string' && Number.isSafeInteger(s?.actionCount)) {
                this.state.set(k, s);
            }
        });
    }

    private loadEvidence(): void {
        const raw = this.walEngine.loadWalSync(this.evidencePath);
        if (!raw) return;
        const data = JsonUtils.safeParse(raw, 'EvidenceStore');
        Object.keys(data).forEach(k => {
            const receipt = data[k];
            if (receipt?.receiptId) {
                this.evidence.set(k, receipt);
                this.evidenceByReceipt.set(receipt.receiptId, k);
            }
        });
    }

    private async persist(): Promise<void> {
        const statsObj: Record<string, BehavioralStats> = {};
        this.state.forEach((v, k) => { statsObj[k] = v; });
        this.walEngine.atomicWriteSync(`${this.walPath}.tmp`, this.walPath, JsonUtils.stableStringify(statsObj));

        const evidenceObj: Record<string, any> = {};
        this.evidence.forEach((v, k) => { evidenceObj[k] = v; });
        this.walEngine.atomicWriteSync(`${this.evidencePath}.tmp`, this.evidencePath, JsonUtils.stableStringify(evidenceObj));
    }

    public async tryIncrementSpend(tenantId: string, deltaSpend: bigint, limit: bigint): Promise<void> {
        const current = this.state.get(tenantId) || {
            totalSpend: "0",
            actionCount: 0,
            lastActionTimestamp: 0,
            velocityScore: 0
        };

        const currentTotal = BigInt(current.totalSpend);
        const projected = currentTotal + deltaSpend;

        if (projected > limit) {
            throw new TerminalRefusalError(`[TERMINAL REFUSAL] Spend limit breached. Current: ${currentTotal}, Requested: ${deltaSpend}, Limit: ${limit}`);
        }

        const updated: BehavioralStats = {
            totalSpend: projected.toString(),
            actionCount: current.actionCount + 1,
            lastActionTimestamp: Date.now(),
            velocityScore: current.velocityScore + 1
        };

        this.state.set(tenantId, updated);
        await this.persist();
    }

    public async rollbackSpend(tenantId: string, deltaSpend: bigint): Promise<void> {
        const current = this.state.get(tenantId);
        if (!current) return;

        const currentTotal = BigInt(current.totalSpend);
        const rolledBackTotal = currentTotal - deltaSpend;

        const updated: BehavioralStats = {
            ...current,
            totalSpend: (rolledBackTotal < 0n ? 0n : rolledBackTotal).toString(),
            // [P2-05] Rollback counters as well
            actionCount: Math.max(0, current.actionCount - 1),
            velocityScore: Math.max(0, current.velocityScore - 1)
        };

        this.state.set(tenantId, updated);
        await this.persist();
    }

    public async saveEvidence(receipt: AegisComplianceReceipt, ledgerTxHash?: string): Promise<void> {
        const txKey = ledgerTxHash || `pending-${receipt.receiptId}`;
        const existingTxKey = this.evidenceByReceipt.get(receipt.receiptId);
        let existingEvidence = {};
        if (existingTxKey) {
            existingEvidence = this.evidence.get(existingTxKey) || {};
            if (existingTxKey !== txKey) {
                this.evidence.delete(existingTxKey);
            }
        }
        const enrichedReceipt = { ...existingEvidence, ...receipt, ledger_tx: ledgerTxHash };
        this.evidence.set(txKey, enrichedReceipt);
        this.evidenceByReceipt.set(receipt.receiptId, txKey);
        await this.persist();
    }

    public async getEvidence(txSignature: string): Promise<any | null> {
        return this.evidence.get(txSignature) || null;
    }

    public async getEvidenceByReceiptId(receiptId: string): Promise<any | null> {
        // [P2-03] Efficient O(1) lookup
        const txKey = this.evidenceByReceipt.get(receiptId);
        return txKey ? this.evidence.get(txKey) : null;
    }

    public async updateZkSeal(receiptId: string, zkSealData: { seal?: string, vkey?: string }): Promise<void> {
        const txKey = this.evidenceByReceipt.get(receiptId);
        if (txKey) {
            const receipt = this.evidence.get(txKey);
            receipt.ars_anchor = zkSealData.seal;
            receipt.zk_vkey = zkSealData.vkey;
            this.evidence.set(txKey, receipt);
            await this.persist();
        }
    }
}
