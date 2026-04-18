import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { INonceRegistry } from '../ports/INonceRegistry';
import { WALEngine } from './WALEngine';
export class AegisLocalNonceRegistry implements INonceRegistry {
    private committedNonces: Set<string> = new Set();
    private pendingNonces: Set<string> = new Set();
    private readonly committedWalPath: string;
    private readonly pendingWalPath: string;
    private readonly lockPath: string;
    private walEngine: WALEngine;

    constructor(customWalPath?: string) {
        const basePath = customWalPath ? customWalPath.replace('.json', '') : path.resolve('/tmp', '.aegis_wal');
        this.committedWalPath = `${basePath}_committed.json`;
        this.pendingWalPath = `${basePath}_pending.json`;
        this.lockPath = `${basePath}.lock`;
        this.walEngine = new WALEngine("aegis-12/wal-encryption-key");

        const committed = this.walEngine.loadWalSync(this.committedWalPath);
        if (committed) {
            const stored = JSON.parse(committed);
            if (Array.isArray(stored)) stored.forEach(n => this.committedNonces.add(n));
        }

        const pending = this.walEngine.loadWalSync(this.pendingWalPath);
        if (pending) {
            const stored = JSON.parse(pending);
            if (Array.isArray(stored)) stored.forEach(n => this.pendingNonces.add(n));
        }
    }

    public async isNonceUsed(nonce: string): Promise<boolean> {
        return this.committedNonces.has(nonce) || this.pendingNonces.has(nonce);
    }

    public async reserve(nonce: string): Promise<boolean> {
        await this.walEngine.acquireLock(this.lockPath);
        try {
            if (this.committedNonces.has(nonce) || this.pendingNonces.has(nonce)) return false;
            const nextPending = new Set(this.pendingNonces);
            nextPending.add(nonce);
            const tempPath = `${this.pendingWalPath}.tmp`;
            this.walEngine.atomicWriteSync(tempPath, this.pendingWalPath, JSON.stringify(Array.from(nextPending)));
            this.pendingNonces.add(nonce);
            return true;
        } catch (e: any) {
            console.error('RESERVE CAUGHT ERROR:', e);
            return false;
        } finally {
            this.walEngine.releaseLock(this.lockPath);
        }
    }

    public async commit(nonce: string): Promise<void> {
        await this.walEngine.acquireLock(this.lockPath);
        try {
            if (this.pendingNonces.has(nonce)) {
                const nextPending = new Set(this.pendingNonces);
                nextPending.delete(nonce);
                const nextCommitted = new Set(this.committedNonces);
                nextCommitted.add(nonce);
                
                const tempCommittedPath = `${this.committedWalPath}.tmp`;
                this.walEngine.atomicWriteSync(tempCommittedPath, this.committedWalPath, JSON.stringify(Array.from(nextCommitted)));
                
                const tempPendingPath = `${this.pendingWalPath}.tmp`;
                this.walEngine.atomicWriteSync(tempPendingPath, this.pendingWalPath, JSON.stringify(Array.from(nextPending)));
                
                this.pendingNonces.delete(nonce);
                this.committedNonces.add(nonce);
            }
        } catch (e) {
            throw new Error("Failed to atomically commit nonce to WAL");
        } finally {
            this.walEngine.releaseLock(this.lockPath);
        }
    }

    public async release(nonce: string): Promise<void> {
        await this.walEngine.acquireLock(this.lockPath);
        try {
            if (!this.pendingNonces.has(nonce)) return;
            const nextPending = new Set(this.pendingNonces);
            nextPending.delete(nonce);
            const tempPendingPath = `${this.pendingWalPath}.tmp`;
            this.walEngine.atomicWriteSync(tempPendingPath, this.pendingWalPath, JSON.stringify(Array.from(nextPending)));
            this.pendingNonces.delete(nonce);
        } catch (e) {
            throw new Error("Failed to release nonce from WAL");
        } finally {
            this.walEngine.releaseLock(this.lockPath);
        }
    }

    public async clear(): Promise<void> {
        await this.walEngine.acquireLock(this.lockPath);
        try {
            this.committedNonces.clear();
            this.pendingNonces.clear();
            if (fs.existsSync(this.committedWalPath)) fs.unlinkSync(this.committedWalPath);
            if (fs.existsSync(this.pendingWalPath)) fs.unlinkSync(this.pendingWalPath);
        } finally {
            this.walEngine.releaseLock(this.lockPath);
        }
    }
}
