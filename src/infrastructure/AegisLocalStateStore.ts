import { IAegisStateStore, BehavioralStats } from '../ports/IAegisStateStore';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PhalaTappdMock } from './PhalaTappdMock';
import { WALEngine } from './WALEngine';
export class AegisLocalStateStore implements IAegisStateStore {
    private state: Map<string, BehavioralStats> = new Map();
    private walPath: string;
    private lockPath: string;
    private walEngine: WALEngine;

    constructor(walPath: string = '.aegis_state.json') {
        this.walPath = path.resolve(process.cwd(), walPath);
        this.lockPath = `${this.walPath}.lock`;
        this.walEngine = new WALEngine("aegis-12/wal-state-encryption-key");
        this.load();
    }

    private load() {
        const decrypted = this.walEngine.loadWalSync(this.walPath);
        if (decrypted) {
            const data = JSON.parse(decrypted);
            Object.keys(data).forEach(k => this.state.set(k, data[k]));
        }
    }

    private async persist() {
        await this.walEngine.acquireLock(this.lockPath);
        try {
            const data = Object.fromEntries(this.state);
            const tempPath = `${this.walPath}.tmp`;
            this.walEngine.atomicWriteSync(tempPath, this.walPath, JSON.stringify(data));
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

    public async checkpoint(): Promise<void> {
        await this.persist();
    }
}
