import * as fs from 'fs';
import * as path from 'path';

import { INonceRegistry } from '../ports/INonceRegistry';

/**
 * AegisLocalNonceRegistry
 * 
 * [COUNCIL AUDIT 1.2 ACKNOWLEDGEMENT]
 * WARNING: This implementation is structurally limited to Single-Pod execution.
 * It uses local memory and disk WAL for state. In a multi-replica Phala Network
 * deployment, TOCTOU replay attacks are possible across nodes unless 
 * KV_STORE_URL is actively configured with a distributed lock manager 
 * (like Redis or a Solana state layer).
 */
export class AegisLocalNonceRegistry implements INonceRegistry {
    private committedNonces: Set<string>;
    private pendingNonces: Set<string>;
    private readonly walPath: string;
    private readonly kvStoreUrl?: string;

    constructor(customWalPath?: string) {
        this.walPath = customWalPath || path.resolve(process.cwd(), '.aegis_wal.json');
        this.kvStoreUrl = process.env.KV_STORE_URL;
        this.committedNonces = new Set<string>();
        this.pendingNonces = new Set<string>();
        
        if (!this.kvStoreUrl && fs.existsSync(this.walPath)) {
            try {
                const stored = JSON.parse(fs.readFileSync(this.walPath, 'utf-8'));
                if (Array.isArray(stored)) {
                    stored.forEach(n => this.committedNonces.add(n));
                }
            } catch (e) {}
        }
    }

    public async reserve(nonce: string): Promise<boolean> {
        if (this.committedNonces.has(nonce) || this.pendingNonces.has(nonce)) {
            return false;
        }

        if (this.kvStoreUrl) {
            try {
                // Determine remote existence natively
                const req = await fetch(`${this.kvStoreUrl}/reserve/${nonce}`, { method: 'POST' });
                if (!req.ok) return false;
            } catch (e) {
                return false; // Fail closed if cluster is unreachable
            }
        }

        this.pendingNonces.add(nonce);
        return true;
    }

    public async commit(nonce: string): Promise<void> {
        if (this.pendingNonces.has(nonce)) {
            this.pendingNonces.delete(nonce);
            this.committedNonces.add(nonce);
            
            if (this.kvStoreUrl) {
                try {
                	await fetch(`${this.kvStoreUrl}/commit/${nonce}`, { method: 'POST' });
                } catch(e) {}
            } else {
                this.syncWal();
            }
        }
    }

    public async rollback(nonce: string): Promise<void> {
        this.pendingNonces.delete(nonce);
        if (this.kvStoreUrl) {
           try {
               await fetch(`${this.kvStoreUrl}/rollback/${nonce}`, { method: 'POST' });
           } catch(e) {}
        }
    }

    private syncWal(): void {
        fs.writeFileSync(this.walPath, JSON.stringify(Array.from(this.committedNonces)));
    }

    public clear(): void {
        this.committedNonces.clear();
        this.pendingNonces.clear();
        if (fs.existsSync(this.walPath)) {
            fs.unlinkSync(this.walPath);
        }
    }
}
