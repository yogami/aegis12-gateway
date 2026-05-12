import { anchor } from './src/application/PhalaEntrypoint';

async function run() {
    try {
        console.log("Requesting airdrop...");
        await anchor.requestAirdrop(2000000000); // 2 SOL
        console.log("Airdrop successful.");
        
        const receipt = { actionId: "test-123", timestamp: new Date().toISOString() };
        console.log("Anchoring receipt...");
        const result = await anchor.anchorReceipt(receipt, "approved", "did:test:123");
        console.log("Anchored!", result);
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
