import { IAegisStateStore, BehavioralStats } from '../ports/IAegisStateStore';
import * as fs from 'fs';
import * as path from 'path';

export class AegisLocalStateStore implements IAegisStateStore {
    private state: Map<string, BehavioralStats> = new Map();
    private walPath: string;

    constructor(walPath: string = '.aegis_wal.json') {
        this.walPath = path.resolve(process.cwd(), walPath);
        this.load();
    }

    private load() {
        if (fs.existsSync(this.walPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.walPath, 'utf-8'));
                Object.keys(data).forEach(k => this.state.set(k, data[k]));
            } catch (e) {
                // In a production TEE, we would fail-closed here if sealing is compromised
            }
        }
    }

    private persist() {
        const data = Object.fromEntries(this.state);
        fs.writeFileSync(this.walPath, JSON.stringify(data, null, 2));
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
            velocityScore: current.velocityScore + 1 // Simple count for MVP
        };
        this.state.set(agentId, updated);
        this.persist();
        return updated;
    }

    public async checkpoint(): Promise<void> {
        this.persist();
    }
}
