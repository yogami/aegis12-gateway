export interface BehavioralStats {
    totalSpend: number;
    actionCount: number;
    lastActionTimestamp: number;
    velocityScore: number; // Moving average or simple count in interval
}

export interface IAegisStateStore {
    getStats(agentId: string): Promise<BehavioralStats>;
    updateStats(agentId: string, deltaSpend: number): Promise<BehavioralStats>;
    checkpoint(): Promise<void>; // Anchoring hook for Solana
}
