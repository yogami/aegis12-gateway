import { IAegisStateStore, BehavioralStats } from '../ports/IAegisStateStore';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PhalaTappdMock } from './PhalaTappdMock';

export class AegisLocalStateStore implements IAegisStateStore {
    private state: Map<string, BehavioralStats> = new Map();
    private walPath: string;
    private lockPath: string;

    constructor(walPath: string = '.aegis_state.json') {
        this.walPath = path.resolve(process.cwd(), walPath);
        this.lockPath = `${this.walPath}.lock`;
        this.load();
    }

    private getWalKey(): Buffer {
        const tappd = new PhalaTappdMock();
        const keyHex = tappd.deriveKey("aegis-12/wal-state-encryption-key");
        return Buffer.from(keyHex.replace('0x', '').slice(0, 64), 'hex');
    }

    private encryptWal(data: string): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.getWalKey(), iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return JSON.stringify({ iv: iv.toString('hex'), encrypted, authTag: cipher.getAuthTag().toString('hex') });
    }

    private decryptWal(payload: string): string {
        try {
            const parsed = JSON.parse(payload);
            const decipher = crypto.createDecipheriv('aes-256-gcm', this.getWalKey(), Buffer.from(parsed.iv, 'hex'));
            decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
            let decrypted = decipher.update(parsed.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (e) {
            throw new Error("[TERMINAL REFUSAL] WAL Integrity Compromised: Failed to decrypt state file.");
        }
    }

    private async acquireLock(): Promise<void> {
        for (let i = 0; i < 50; i++) {
            try {
                const fd = fs.openSync(this.lockPath, 'wx');
                fs.closeSync(fd);
                return;
            } catch (e) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        throw new Error("[TERMINAL REFUSAL] Failed to acquire WAL state lock");
    }

    private releaseLock(): void {
        try { if (fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath); } catch (e) {}
    }

    private load() {
        if (fs.existsSync(this.walPath)) {
            try {
                const raw = fs.readFileSync(this.walPath, 'utf-8');
                const data = JSON.parse(this.decryptWal(raw));
                Object.keys(data).forEach(k => this.state.set(k, data[k]));
            } catch (e) {
                throw new Error("[TERMINAL REFUSAL] WAL integrity compromised.");
            }
        }
    }

    private async persist() {
        await this.acquireLock();
        try {
            const data = Object.fromEntries(this.state);
            const encryptedData = this.encryptWal(JSON.stringify(data));
            const tempPath = `${this.walPath}.tmp`;
            const fd = fs.openSync(tempPath, 'w');
            try {
                fs.writeSync(fd, encryptedData);
                fs.fdatasyncSync(fd);
            } finally {
                fs.closeSync(fd);
            }
            fs.renameSync(tempPath, this.walPath);
        } finally {
            this.releaseLock();
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
