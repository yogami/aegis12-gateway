import * as fs from 'fs';
import * as crypto from 'crypto';
import { PhalaTappdMock } from './PhalaTappdMock';

export class WALEngine {
    private derivationPath: string;

    constructor(derivationPath: string) {
        this.derivationPath = derivationPath;
    }

    private getWalKey(): Buffer {
        const tappd = new PhalaTappdMock();
        const keyHex = tappd.deriveKey(this.derivationPath);
        return Buffer.from(keyHex.replace('0x', '').slice(0, 64), 'hex');
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
        } catch (e) {
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
        try { if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } catch (e) {}
    }

    public atomicWriteSync(tempPath: string, targetPath: string, data: string): void {
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
    
    public loadWalSync(targetPath: string): string | null {
        if (fs.existsSync(targetPath)) {
            try {
                const raw = fs.readFileSync(targetPath, 'utf-8');
                return this.decryptWal(raw);
            } catch (e) {
                throw new Error("[TERMINAL REFUSAL] WAL integrity compromised.");
            }
        }
        return null;
    }
}
