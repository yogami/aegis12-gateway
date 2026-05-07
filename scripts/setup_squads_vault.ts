import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

/**
 * setup_squads_vault.ts
 * 
 * Simulates the "Budget Grant" phase of the Aegis-12 architecture.
 * In a full production environment, this would use the Squads V4 Spending Limits extension.
 * For the 72-hour MVP, we provision a "Session Wallet" (controlled by the local TEE)
 * and grant it a strict budget (e.g., 0.1 SOL) from the admin treasury.
 */
async function run() {
    console.log("🛡️ Aegis-12: Provisioning TEE Session Wallet & Budget...");

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // 1. Load the Admin Treasury Key (Simulating the Squads Owner)
    const adminSecret = process.env.SOLANA_PAYER_SECRET;
    if (!adminSecret) throw new Error("SOLANA_PAYER_SECRET is not set.");
    const adminKeypair = Keypair.fromSecretKey(Buffer.from(adminSecret, 'base64'));

    console.log(`[Admin Treasury] Pubkey: ${adminKeypair.publicKey.toBase58()}`);

    // 2. The TEE Enclave "generates" a hardware-bound key.
    // For the demo, we generate it here and save it so the local TEE process can use it.
    const teeSessionKeypair = Keypair.generate();
    console.log(`[TEE Session] Generated Ephemeral Hardware Key: ${teeSessionKeypair.publicKey.toBase58()}`);

    // Write the TEE private key to a temporary local file so the PolicyEnclave can load it
    fs.writeFileSync('.tee_session.json', JSON.stringify(Array.from(teeSessionKeypair.secretKey)));
    console.log(`[TEE Session] Secret key securely injected into TEE context (.tee_session.json).`);

    // 3. Grant the Bounded Budget
    // Transfer 0.05 SOL to the TEE Session Wallet. This is the absolute maximum blast radius.
    const budgetSol = 0.05;
    const lamports = budgetSol * LAMPORTS_PER_SOL;

    console.log(`[Vault] Granting ${budgetSol} SOL budget to TEE Session Wallet...`);

    const transferTx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: adminKeypair.publicKey,
            toPubkey: teeSessionKeypair.publicKey,
            lamports
        })
    );

    const txSig = await sendAndConfirmTransaction(connection, transferTx, [adminKeypair]);
    
    console.log(`✅ Budget Grant Confirmed!`);
    console.log(`📜 Transaction: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
    console.log(`\nThe Local TEE is now armed with a strict budget. It can execute zero-latency trades independently.`);
}

run().catch(console.error);
