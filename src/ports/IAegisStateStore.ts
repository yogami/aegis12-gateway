export interface BehavioralStats {
    totalSpend: string; // Store as string to avoid BigInt precision loss
    actionCount: number;
    lastActionTimestamp: number;
    velocityScore: number; // Moving average or simple count in interval
}

export interface IAegisStateStore {
    initialize?(): Promise<void>;
    getStats(agentId: string): Promise<BehavioralStats>;
    updateStats(agentId: string, deltaSpend: string): Promise<BehavioralStats>;
    /**
     * Atomically increments spend and returns the new stats if under the limit.
     * Prevents TOCTOU races by performing check and increment in a single locked operation.
     * @throws {Error} if increment would breach the limit.
     */
    tryIncrementSpend(agentId: string, deltaSpend: bigint, limit: bigint): Promise<BehavioralStats>;
    /**
     * Atomically rolls back a previously incremented spend.
     * Used for compensation in case of late-path failures.
     */
    rollbackSpend(agentId: string, deltaSpend: bigint): Promise<void>;
    saveEvidence(receipt: any, solanaTx?: string): Promise<void>;
    getEvidence(txSignature: string): Promise<any | null>;
    getEvidenceByReceiptId(receiptId: string): Promise<any | null>;
    updateZkSeal(receiptId: string, zkSealData: { seal?: string, vkey?: string }): Promise<void>;
    updateBatchProof(batchId: string, merkleRoot: string, pqSignature: string, proofs: Record<string, string[]>): Promise<void>;
    checkpoint(): Promise<void>; // Anchoring hook for Solana
}
