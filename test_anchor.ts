import { SolanaAnchor } from './src/infrastructure/SolanaAnchor';
import { Keypair } from '@solana/web3.js';
async function run() {
    try {
        console.log("Initializing Anchor...");
        const anchor = new SolanaAnchor('devnet');
        console.log("Payer:", anchor.getPayerPublicKey());
        
        console.log("Attempting to anchor a receipt...");
        const receipt = {
            actionId: 'act-test-' + Date.now(),
            timestamp: new Date().toISOString()
        };
        const result = await anchor.anchorReceipt(receipt, 'approved', 'did:test');
        console.log("Anchored successfully:", result.txSignature);
    } catch(e) {
        console.error("Anchoring failed:", e);
    }
}
run();
