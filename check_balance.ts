import { Connection, PublicKey } from '@solana/web3.js';
async function run() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const pubkey = new PublicKey('AVMW4x3afTUCt8W9smpK9Qya49stdfSUj8oU2XCaqmCV');
    const balance = await connection.getBalance(pubkey);
    console.log("Balance of AVMW4x3afTUCt8W9smpK9Qya49stdfSUj8oU2XCaqmCV is: " + balance + " lamports");
}
run();
