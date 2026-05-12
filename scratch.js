const { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require('@solana/web3.js');
async function run() {
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const kp = Keypair.generate();
    console.log("Airdropping to new wallet...");
    const sig = await connection.requestAirdrop(kp.publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig);
    console.log("Balance:", await connection.getBalance(kp.publicKey));
    
    console.log("Sending to self...");
    try {
        const tx1 = new Transaction().add(SystemProgram.transfer({
            fromPubkey: kp.publicKey,
            toPubkey: kp.publicKey,
            lamports: 1000
        }));
        await sendAndConfirmTransaction(connection, tx1, [kp]);
        console.log("Self send SUCCESS");
    } catch(e) {
        console.log("Self send ERROR:", e.message);
    }
}
run();
