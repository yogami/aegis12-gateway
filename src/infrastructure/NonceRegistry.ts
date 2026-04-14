import * as fs from 'fs';
import * as path from 'path';

export interface INonceRegistry {
    reserve(nonce: string): Promise<boolean>;
    commit(nonce: string): Promise<void>;
    rollback(nonce: string): Promise<void>;
}

export class AegisLocalNonceRegistry implements INonceRegistry {
    private committedNonces: Set<string>;
    private pendingNonces: Set<string>;
    private readonly walPath: string;

    constructor() {
        this.walPath = path.resolve(process.cwd(), '.aegis_wal.json');
        this.committedNonces = new Set<string>();
        this.pendingNonces = new Set<string>();
        
        if (fs.existsSync(this.walPath)) {
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
        this.pendingNonces.add(nonce);
        return true;
    }

    public async commit(nonce: string): Promise<void> {
        if (this.pendingNonces.has(nonce)) {
            this.pendingNonces.delete(nonce);
            this.committedNonces.add(nonce);
            this.syncWal();
        }
    }

    public async rollback(nonce: string): Promise<void> {
        this.pendingNonces.delete(nonce);
    }

    private syncWal(): void {
        fs.writeFileSync(this.walPath, JSON.stringify(Array.from(this.committedNonces)));
    }
}
