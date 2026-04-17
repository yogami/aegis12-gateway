import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { INonceRegistry } from '../ports/INonceRegistry';
import { PhalaTappdMock } from './PhalaTappdMock';

export class AegisLocalNonceRegistry implements INonceRegistry {
    private committedNonces: Set<string> = new Set();
    private pendingNonces: Set<string> = new Set();
    private readonly committedWalPath: string;
    private readonly pendingWalPath: string;
    private readonly lockPath: string;

    constructor(customWalPath?: string) {
        const basePath = customWalPath ? customWalPath.replace('.json', '') : path.resolve(process.cwd(), '.aegis_wal');
        this.committedWalPath = `${basePath}_committed.json`;
        this.pendingWalPath = `${basePath}_pending.json`;
        this.lockPath = `${basePath}.lock`;

        if (fs.existsSync(this.committedWalPath)) {
            try {
                const raw = fs.readFileSync(this.committedWalPath, 'utf-8');
                const stored = JSON.parse(this.decryptWal(raw));
                if (Array.isArray(stored)) stored.forEach(n => this.committedNonces.add(n));
            } catch (e) {}
        }

        if (fs.existsSync(this.pendingWalPath)) {
            try {
                const raw = fs.readFileSync(this.pendingWalPath, 'utf-8');
                const stored = JSON.parse(this.decryptWal(raw));
                if (Array.isArray(stored)) stored.forEach(n => this.pendingNonces.add(n));
            } catch (e) {}
        }
    }

    private getWalKey(): Buffer {
        const tappd = new PhalaTappdMock();
        const keyHex = tappd.deriveKey("aegis-12/wal-encryption-key");
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
        throw new Error("[TERMINAL REFUSAL] Failed to acquire WAL lock");
    }

    private releaseLock(): void {
        try { if (fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath); } catch (e) {}
    }

    private atomicWriteSync(tempPath: string, targetPath: string, data: string): void {
        const encryptedData = this.encryptWal(data);
        const fd = fs.openSync(tempPath, 'w');
        try {
            fs.writeSync(fd, encryptedData);
            fs.fdatasyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(tempPath, targetPath);
    }

    public async isNonceUsed(nonce: string): Promise<boolean> {
        return this.committedNonces.has(nonce) || this.pendingNonces.has(nonce);
    }

    public async reserve(nonce: string): Promise<boolean> {
        await this.acquireLock();
        try {
            if (this.committedNonces.has(nonce) || this.pendingNonces.has(nonce)) return false;
            const nextPending = new Set(this.pendingNonces);
            nextPending.add(nonce);
            const tempPath = `${this.pendingWalPath}.tmp`;
            this.atomicWriteSync(tempPath, this.pendingWalPath, JSON.stringify(Array.from(nextPending)));
            this.pendingNonces.add(nonce);
            return true;
        } catch (e: any) {
            console.error('RESERVE CAUGHT ERROR:', e);
            return false;
        } finally {
            this.releaseLock();
        }
    }

    public async commit(nonce: string): Promise<void> {
        await this.acquireLock();
        try {
            if (this.pendingNonces.has(nonce)) {
                const nextPending = new Set(this.pendingNonces);
                nextPending.delete(nonce);
                const nextCommitted = new Set(this.committedNonces);
                nextCommitted.add(nonce);
                
                const tempCommittedPath = `${this.committedWalPath}.tmp`;
                this.atomicWriteSync(tempCommittedPath, this.committedWalPath, JSON.stringify(Array.from(nextCommitted)));
                
                const tempPendingPath = `${this.pendingWalPath}.tmp`;
                this.atomicWriteSync(tempPendingPath, this.pendingWalPath, JSON.stringify(Array.from(nextPending)));
                
                this.pendingNonces.delete(nonce);
                this.committedNonces.add(nonce);
            }
        } catch (e) {
            throw new Error("Failed to atomically commit nonce to WAL");
        } finally {
            this.releaseLock();
        }
    }

    public async release(nonce: string): Promise<void> {
        await this.acquireLock();
        try {
            if (!this.pendingNonces.has(nonce)) return;
            const nextPending = new Set(this.pendingNonces);
            nextPending.delete(nonce);
            const tempPendingPath = `${this.pendingWalPath}.tmp`;
            this.atomicWriteSync(tempPendingPath, this.pendingWalPath, JSON.stringify(Array.from(nextPending)));
            this.pendingNonces.delete(nonce);
        } catch (e) {
            throw new Error("Failed to release nonce from WAL");
        } finally {
            this.releaseLock();
        }
    }

    public async clear(): Promise<void> {
        await this.acquireLock();
        try {
            this.committedNonces.clear();
            this.pendingNonces.clear();
            if (fs.existsSync(this.committedWalPath)) fs.unlinkSync(this.committedWalPath);
            if (fs.existsSync(this.pendingWalPath)) fs.unlinkSync(this.pendingWalPath);
        } finally {
            this.releaseLock();
        }
    }
}
