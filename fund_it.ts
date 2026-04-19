import { Connection, PublicKey } from '@solana/web3.js';
async function run() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const pubkey = new PublicKey('AVMW4x3afTUCt8W9smpK9Qya49stdfSUj8oU2XCaqmCV');
    try {
        const sig = await connection.requestAirdrop(pubkey, 2000000000);
        await connection.confirmTransaction(sig);
        console.log("Airdrop success! Sig:", sig);
    } catch(e) {
        console.log("Airdrop failed:", e.message);
    }
}
run();
