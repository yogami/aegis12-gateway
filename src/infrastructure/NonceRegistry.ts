import * as fs from 'fs';
import * as path from 'path';
import { INonceRegistry } from '../ports/INonceRegistry';

export class AegisLocalNonceRegistry implements INonceRegistry {
    private committedNonces: Set<string> = new Set();
    private pendingNonces: Set<string> = new Set();
    private readonly walPath: string;

    constructor(customWalPath?: string) {
        this.walPath = customWalPath || path.resolve(process.cwd(), '.aegis_wal.json');
        if (fs.existsSync(this.walPath)) {
            try {
                const stored = JSON.parse(fs.readFileSync(this.walPath, 'utf-8'));
                if (Array.isArray(stored)) stored.forEach(n => this.committedNonces.add(n));
            } catch (e) {}
        }
    }

    public async isNonceUsed(nonce: string): Promise<boolean> {
        return this.committedNonces.has(nonce) || this.pendingNonces.has(nonce);
    }

    public async reserve(nonce: string): Promise<boolean> {
        // ATOMIC CHECK & ADD
        if (this.committedNonces.has(nonce) || this.pendingNonces.has(nonce)) return false;
        this.pendingNonces.add(nonce);
        return true;
    }

    public async commit(nonce: string): Promise<void> {
        if (this.pendingNonces.has(nonce)) {
            this.pendingNonces.delete(nonce);
            this.committedNonces.add(nonce);
            fs.writeFileSync(this.walPath, JSON.stringify(Array.from(this.committedNonces)));
        }
    }

    public async release(nonce: string): Promise<void> {
        this.pendingNonces.delete(nonce);
    }

    public clear(): void {
        this.committedNonces.clear();
        this.pendingNonces.clear();
        if (fs.existsSync(this.walPath)) fs.unlinkSync(this.walPath);
    }
}
