import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

/**
 * scripts/fund_test_wallet.ts
 * 
 * Automatically funds a Solana wallet on devnet using the official faucet.
 * Used by CI/CD to ensure the enclave's ephemeral payer has SOL for receipt anchoring.
 */
async function fund() {
    const pubkeyStr = process.argv[2];
    if (!pubkeyStr) {
        console.error("Usage: tsx scripts/fund_test_wallet.ts <PUBKEY>");
        process.exit(1);
    }

    try {
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        const pubkey = new PublicKey(pubkeyStr);

        console.log(`[Faucet] 🔍 Checking balance for ${pubkeyStr}...`);
        const balance = await connection.getBalance(pubkey);
        
        if (balance > 500_000_000) { // 0.5 SOL is enough for many anchors
            console.log(`[Faucet] ✅ Wallet already has ${balance / 1_000_000_000} SOL. Skipping airdrop.`);
            return;
        }

        console.log(`[Faucet] 🚰 Requesting airdrop (1 SOL) for ${pubkeyStr}...`);
        const sig = await connection.requestAirdrop(pubkey, 1_000_000_000);
        
        console.log(`[Faucet] ⏳ Confirming transaction ${sig}...`);
        await connection.confirmTransaction(sig, 'confirmed');
        
        const newBalance = await connection.getBalance(pubkey);
        console.log(`[Faucet] ✅ Funded! New balance: ${newBalance / 1_000_000_000} SOL.`);
    } catch (e: any) {
        console.error(`[Faucet] ❌ Airdrop failed: ${e.message}`);
        // We don't exit with 1 because the airdrop might fail due to rate limits
        // but the wallet might already have enough from a previous run or a manual top-up.
        process.exit(0);
    }
}

fund();
