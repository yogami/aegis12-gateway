export interface BehavioralStats {
    totalSpend: number;
    actionCount: number;
    lastActionTimestamp: number;
    velocityScore: number; // Moving average or simple count in interval
}

export interface IAegisStateStore {
    initialize?(): Promise<void>;
    getStats(agentId: string): Promise<BehavioralStats>;
    updateStats(agentId: string, deltaSpend: number): Promise<BehavioralStats>;
    saveEvidence(receipt: any, solanaTx?: string): Promise<void>;
    getEvidence(txSignature: string): Promise<any | null>;
    getEvidenceByReceiptId(receiptId: string): Promise<any | null>;
    updateZkSeal(receiptId: string, zkSealData: { seal?: string, vkey?: string }): Promise<void>;
    updateBatchProof(batchId: string, merkleRoot: string, pqSignature: string, proofs: Record<string, string[]>): Promise<void>;
    checkpoint(): Promise<void>; // Anchoring hook for Solana
}
