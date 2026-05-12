import { WALEngine } from './src/infrastructure/WALEngine';
import * as fs from 'fs';

async function main() {
    const walEngine = new WALEngine("aegis-12/wal-state-encryption-key");
    // Try mock key first
    walEngine.initializeSync();
    
    try {
        const evidencePath = './.aegis_evidence.json';
        if (fs.existsSync(evidencePath)) {
            const raw = fs.readFileSync(evidencePath, 'utf-8');
            const decrypted = walEngine.decryptWal(raw);
            console.log('Decrypted Evidence:', decrypted);
        } else {
            console.log('Evidence file not found.');
        }
    } catch (e) {
        console.error('Failed to decrypt with mock key. File might be hardware-encrypted.');
    }
}

main();
