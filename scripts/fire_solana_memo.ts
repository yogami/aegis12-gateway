import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SolanaMemoAnchor } from "../packages/telemetry-shield/src/anchors/solana_memo";
import { AgentEvidenceRecord } from "../packages/telemetry-shield/src/types";

async function main() {
    console.log("🚀 Starting Unmocked Aegis-12 Solana Integration Test...\n");

    const rpcUrl = "https://api.devnet.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");

    // 1. Setup a fresh ephemeral keypair for this test run
    const keypair = Keypair.generate();
    console.log(`🔐 Generated Temporary Wallet: ${keypair.publicKey.toBase58()}`);

    // 2. Request a micro-airdrop to pay for the memo transaction fees
    console.log(`💸 Requesting Devnet Airdrop to pay for Logging Gas...`);
    try {
        const airdropSignature = await connection.requestAirdrop(keypair.publicKey, 0.05 * LAMPORTS_PER_SOL);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            blockhash,
            lastValidBlockHeight,
            signature: airdropSignature,
        }, "confirmed");
        console.log(`✅ Airdrop successful!`);
    } catch (e: any) {
        console.warn(`⚠️ Airdrop rate-limited or failed: ${e.message}`);
        console.log(`Continuing anyway. It might fail if no balance, but we try.`);
    }

    // 3. Initialize the Unmocked Anchor
    const secretB58 = `[${keypair.secretKey.toString()}]`;
    const memoAnchor = new SolanaMemoAnchor(rpcUrl, secretB58);

    // 4. Create a mock Agent Evidence Record (The Alpha Hash)
    const mockRecord: AgentEvidenceRecord = {
        timestamp: new Date().toISOString(),
        agent_id: "AEGIS_VANILLA_TEST_AGENT_001",
        input_snapshot_hash: "a3b9c7d42f8149e6b4d3a1f9e2b0c4d5a7f9b3e1d6c8a2b5f7e4d9c1a5b8f2d",
        policy_flags: ["EU_AI_ACT_ART_12_COMPLIANT"]
    };

    console.log(`\n🛡️ Submitting Compliance Hash to ${memoAnchor.anchorName}...`);
    // 5. Fire!
    await memoAnchor.submitEvidence(mockRecord);
    
    console.log(`\n🏁 Test Run complete. Check Solscan link above to verify.`);
}

main().catch(console.error);
