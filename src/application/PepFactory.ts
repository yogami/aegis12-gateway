import { AegisSigner } from '../infrastructure/AegisSigner';
import { AegisPEP } from '../infrastructure/AegisPEP';
import { JsonUtils } from '../infrastructure/JsonUtils';
import { TappdClient } from '../infrastructure/TappdClient';
import { AegisJournal } from '../infrastructure/AegisJournal';

export class PepFactory {
    public static async createPep(signer: AegisSigner): Promise<{ pep: AegisPEP, journal: AegisJournal }> {
        const tenants = this.parseTenants();
        const dataDir = this.getDataDir();
        const walSecret = await this.getWalSecret();
        
        const { AegisLocalNonceRegistry } = await import('../infrastructure/NonceRegistry');
        const { AegisLocalStateStore } = await import('../infrastructure/AegisLocalStateStore');
        
        const nonceReg = new AegisLocalNonceRegistry(`${dataDir}/nonce_registry.json`);
        await nonceReg.initialize();
        
        const stateStore = new AegisLocalStateStore(dataDir, walSecret);
        await stateStore.initialize();
        
        const journal = new AegisJournal(`${dataDir}/aegis_journal.log`);
        const pep = new AegisPEP(signer, tenants, nonceReg, stateStore, journal);
        
        return { pep, journal };
    }

    private static parseTenants(): any {
        let raw = process.env.AUTHORIZED_TENANTS || '{}';
        if (raw.startsWith("'") && raw.endsWith("'")) {
            raw = raw.slice(1, -1);
        }
        return JsonUtils.safeParse(raw, 'AUTHORIZED_TENANTS');
    }

    private static getDataDir(): string {
        const isTest = process.env.NODE_ENV === 'test';
        if (isTest) {
            const workerId = process.env.VITEST_WORKER_ID || process.env.VITEST_POOL_ID || '0';
            const dir = `/tmp/aegis_test_${workerId}`;
            if (!require('fs').existsSync(dir)) {
                require('fs').mkdirSync(dir, { recursive: true });
            }
            return dir;
        }
        const isCvm = process.env.PHALA_CVM_ENVIRONMENT;
        return !isCvm ? '/tmp' : '/var/data';
    }

    private static async getWalSecret(): Promise<string | undefined> {
        const walSecret = process.env.WAL_SECRET;
        if (walSecret) return walSecret;
        if (process.env.TEE_ENV === 'phala') {
            console.log("[Aegis-12] WAL_SECRET missing. Deriving from hardware...");
            return new TappdClient().deriveKey("aegis-12/wal-secret", 'secp256k1');
        }
        return undefined;
    }
}
