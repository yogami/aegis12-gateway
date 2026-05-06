import * as fs from 'fs';
import * as crypto from 'crypto';
import { TappdClient } from './TappdClient';
import { PhalaTappdMock } from './PhalaTappdMock';

/**
 * WALEngine — Write-Ahead Log Engine with TEE-Derived Encryption
 * 
 * Uses TappdClient for key derivation, which automatically routes to
 * hardware Root of Trust (Phala dStack) or simulation (PhalaTappdMock)
 * based on environment detection.
 */
export class WALEngine {
    private derivationPath: string;
    private cachedKey: Buffer | null = null;

    constructor(derivationPathOrKey: string | Buffer) {
        if (Buffer.isBuffer(derivationPathOrKey)) {
            this.cachedKey = derivationPathOrKey;
            this.derivationPath = "DIRECT_KEY_INJECTED";
        } else {
            this.derivationPath = derivationPathOrKey;
        }
    }

    /**
     * Initializes the encryption key from the TEE/simulation provider.
     * Must be called before any encrypt/decrypt operations.
     * This is async because TappdClient.deriveKey() uses the hardware socket.
     */
    public async initialize(): Promise<void> {
        if (this.cachedKey) return;
        const tappd = new TappdClient();
        const keyHex = await tappd.deriveKey(this.derivationPath);
        this.cachedKey = Buffer.from(keyHex.replace('0x', '').slice(0, 64), 'hex');
    }

    /**
     * Synchronous key derivation fallback for constructors that
     * cannot await. Uses PhalaTappdMock directly (documented mock usage).
     * Callers should prefer initialize() + async operations when possible.
     */
    public initializeSync(): void {
        if (this.cachedKey) return;
        if (process.env.TEE_ENV === 'phala') {
            throw new Error("[TERMINAL REFUSAL] Async initialization mandatory in TEE mode. Hardware Root of Trust required.");
        }
        const tappd = new PhalaTappdMock();
        const keyHex = tappd.deriveKey(this.derivationPath);
        this.cachedKey = Buffer.from(keyHex.replace('0x', '').slice(0, 64), 'hex');
        console.warn('[WALEngine] Using synchronous mock key derivation. Call initialize() for hardware TEE support.');
    }

    private getWalKey(): Buffer {
        if (!this.cachedKey) {
            // Auto-init with sync fallback if caller didn't call initialize()
            this.initializeSync();
        }
        return this.cachedKey!;
    }

    public encryptWal(data: string): string {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.getWalKey(), iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return JSON.stringify({ iv: iv.toString('hex'), encrypted, authTag: cipher.getAuthTag().toString('hex') });
    }

    public decryptWal(payload: string): string {
        try {
            const parsed = JSON.parse(payload);
            const decipher = crypto.createDecipheriv('aes-256-gcm', this.getWalKey(), Buffer.from(parsed.iv, 'hex'));
            decipher.setAuthTag(Buffer.from(parsed.authTag, 'hex'));
            let decrypted = decipher.update(parsed.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (e: any) {
            console.error(`[WALEngine] decryptWal error:`, e.message);
            throw new Error("[TERMINAL REFUSAL] WAL Integrity Compromised: Failed to decrypt state file.");
        }
    }

    public async acquireLock(lockPath: string): Promise<void> {
        for (let i = 0; i < 50; i++) {
            try {
                const fd = fs.openSync(lockPath, 'wx');
                fs.closeSync(fd);
                return;
            } catch (e) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        throw new Error(`[TERMINAL REFUSAL] Failed to acquire WAL lock at ${lockPath}`);
    }

    public releaseLock(lockPath: string): void {
        try { 
            if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); 
        } catch (e) {
            // Ignore file not found errors during unlock
        }
    }

    public atomicWriteSync(tempPath: string, targetPath: string, data: string): void {
        const uniqueTempPath = `${tempPath}.${crypto.randomUUID()}`;
        const encryptedData = this.encryptWal(data);
        const fd = fs.openSync(uniqueTempPath, 'w');
        try {
            fs.writeSync(fd, encryptedData);
            fs.fdatasyncSync(fd);
        } finally {
            fs.closeSync(fd);
        }
        fs.renameSync(uniqueTempPath, targetPath);
    }
    
    public loadWalSync(targetPath: string): string | null {
        if (fs.existsSync(targetPath)) {
            try {
                const raw = fs.readFileSync(targetPath, 'utf-8');
                return this.decryptWal(raw);
            } catch (e: any) {
                console.error(`[WALEngine] Decryption/Read error on ${targetPath}:`, e.message);
                throw new Error("[TERMINAL REFUSAL] WAL integrity compromised.");
            }
        }
        return null;
    }
}
