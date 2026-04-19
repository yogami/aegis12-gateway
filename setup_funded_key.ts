import { Keypair, Connection } from '@solana/web3.js';
const keypair = Keypair.generate();
console.log("PUBKEY:", keypair.publicKey.toBase58());
console.log("SECRET:", Buffer.from(keypair.secretKey).toString('base64'));
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
async function fund() {
    for (let i = 0; i < 5; i++) {
        try {
            console.log("Requesting airdrop attempt", i+1);
            const sig = await connection.requestAirdrop(keypair.publicKey, 2000000000);
            await connection.confirmTransaction(sig);
            console.log("Success! Sig:", sig);
            process.exit(0);
        } catch (e) {
            console.log("Airdrop failed:", e.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}
fund();
