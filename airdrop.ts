import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const secretKeyStr = process.env.SOLANA_PAYER_SECRET;
    if (!secretKeyStr) {
        console.log("No secret key found.");
        return;
    }
    const secretKeyBytes = Uint8Array.from(Buffer.from(secretKeyStr, 'base64'));
    const keypair = Keypair.fromSecretKey(secretKeyBytes);
    console.log(`Public Key: ${keypair.publicKey.toBase58()}`);
    console.log(`Requesting airdrop of 2 SOL...`);
    const sig = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    console.log(`Airdrop successful!`);
}
main().catch(console.error);
