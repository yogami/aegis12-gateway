import { Connection, Transaction, PublicKey, SystemProgram } from '@solana/web3.js';
import { SolanaTransactionFirewall } from './src/infrastructure/SolanaTransactionFirewall';
import { AegisSigner } from './src/infrastructure/AegisSigner';

async function main() {
    const mockSigner = await AegisSigner.create();
    const fakeConns = [
        new Connection('http://localhost:8899'),
        new Connection('http://localhost:8899'),
        new Connection('http://localhost:8899'),
        new Connection('http://localhost:8899')
    ];
    // Mock the connection properly
    for (const conn of fakeConns) {
        conn.simulateTransaction = async () => { throw new Error('Network Error') };
    }
    const firewall = new SolanaTransactionFirewall(mockSigner, fakeConns);
    const tx = new Transaction();
    tx.feePayer = new PublicKey('11111111111111111111111111111111');
    tx.recentBlockhash = '11111111111111111111111111111111';
    tx.add({ keys: [], programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), data: Buffer.alloc(0) });
    const dummyTx = tx.serialize({ verifySignatures: false, requireAllSignatures: false }).toString('base64');
    const result = await firewall.inspectTransaction(dummyTx, 'pubkey');
    console.log(JSON.stringify(result.flags, null, 2));
}
main();
