export interface BehavioralStats {
    totalSpend: string; // Store as string to avoid BigInt precision loss
    actionCount: number;
    lastActionTimestamp: number;
    velocityScore: number; // Moving average or simple count in interval
}

export interface IAegisStateStore {
    initialize?(): Promise<void>;
    tryIncrementSpend(agentId: string, deltaSpend: bigint, limit: bigint): Promise<void>;
    rollbackSpend(agentId: string, deltaSpend: bigint): Promise<void>;
    saveEvidence(receipt: any, ledgerTxHash?: string): Promise<void>;
    getEvidence(txSignature: string): Promise<any | null>;
    getEvidenceByReceiptId(receiptId: string): Promise<any | null>;
    updateZkSeal(receiptId: string, zkSealData: { seal?: string, vkey?: string }): Promise<void>;
}
