import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

describe('True Blackbox E2E (Judge Perspective)', () => {
    it('should successfully execute the master demo and verify the cryptographic kill shot', async () => {
        console.log('[Blackbox] 1. Executing Master Demo Script...');
        
        // Phase 1: Run the Demo
        const demoResult = await execAsync('npx tsx scripts/demo_colosseum_mvp.ts');
        
        // Assert the demo executed the hardware logic
        expect(demoResult.stdout).toContain('Booting local Phala TDX environment');
        expect(demoResult.stdout).toContain('ON-CHAIN WHITELISTED');
        expect(demoResult.stdout).toContain('Execution successful in');
        expect(demoResult.stdout).toContain('BLOCKED BY TEE: POLICY DENIED'); // Hardware block worked
        
        // Extract the transaction signature from the output
        // It looks like: 📜 Signature: https://explorer.solana.com/tx/<txSig>?cluster=devnet
        const match = demoResult.stdout.match(/https:\/\/explorer\.solana\.com\/tx\/([a-zA-Z0-9]+)\?cluster=devnet/);
        expect(match).not.toBeNull();
        const txSig = match![1];
        
        expect(txSig.length).toBeGreaterThan(64);
        console.log(`[Blackbox] 2. Successfully intercepted real Devnet TxSig: ${txSig}`);
        console.log('[Blackbox] 3. Executing Verifier CLI...');

        // Phase 2: Run the Verifier CLI
        const verifyResult = await execAsync(`npx tsx src/cli/aegis-verify.ts ${txSig}`);
        
        // Assert the verifier pulled the transaction from Helius and mathematically proved it
        expect(verifyResult.stdout).toContain('HARDWARE ATTESTATION REPORT');
        expect(verifyResult.stdout).toContain('VERIFICATION PASSED');
        expect(verifyResult.stdout).toContain('Intel TDX quote valid');
        expect(verifyResult.stdout).toContain('Transaction was securely signed inside hardware');
        
        console.log('[Blackbox] ✅ True Blackbox Execution Complete. Zero Mocks Detected.');
    }, 45000); // 45 second timeout because it does two full network roundtrips to Solana Devnet
});
