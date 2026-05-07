import { IAegisVaultStore } from '../ports/IAegisVaultStore';
import { TerminalRefusalError } from '../errors';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Local implementation of the Policy Vault.
 * Stores encrypted policies in the CVM local storage (e.g. /tmp/.aegis_vault/).
 */
export class AegisLocalVaultStore implements IAegisVaultStore {
    private readonly vaultDir: string;

    constructor(baseDir: string = '/tmp/.aegis_vault') {
        this.vaultDir = baseDir;
        if (!fs.existsSync(this.vaultDir)) {
            fs.mkdirSync(this.vaultDir, { recursive: true });
        }
    }

    public async savePolicy(tenantId: string, policyId: string, encryptedData: any): Promise<void> {
        this.validateInput(tenantId, policyId);
        
        const dataStr = JSON.stringify(encryptedData);
        if (Buffer.byteLength(dataStr, 'utf8') > 5 * 1024 * 1024) { // 5MB Limit for ML weights
            throw new TerminalRefusalError("Policy exceeds 5MB limit.");
        }

        const filePath = this.getFilePath(tenantId, policyId);
        fs.writeFileSync(filePath, dataStr, { encoding: 'utf8', mode: 0o600 });
        console.log(`[AegisVault] Saved policy ${policyId} for tenant ${tenantId}.`);
    }

    public async getPolicy(tenantId: string, policyId: string): Promise<any | null> {
        this.validateInput(tenantId, policyId);
        const filePath = this.getFilePath(tenantId, policyId);
        
        if (!fs.existsSync(filePath)) {
            return null;
        }

        try {
            const dataStr = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(dataStr);
        } catch (e: any) {
            console.error(`[AegisVault] Failed to read policy ${policyId}: ${e.message}`);
            return null;
        }
    }

    private getFilePath(tenantId: string, policyId: string): string {
        // Sanitize to prevent path traversal
        const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '');
        const safePolicy = policyId.replace(/[^a-zA-Z0-9_-]/g, '');
        
        const tenantDir = path.join(this.vaultDir, safeTenant);
        if (!fs.existsSync(tenantDir)) {
            fs.mkdirSync(tenantDir, { recursive: true });
        }
        
        return path.join(tenantDir, `${safePolicy}.json`);
    }

    private validateInput(tenantId: string, policyId: string): void {
        if (!tenantId || !policyId) {
            throw new TerminalRefusalError("tenantId and policyId are required.");
        }
    }
}
