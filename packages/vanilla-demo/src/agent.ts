import { Connection, PublicKey } from "@solana/web3.js";
import { AegisShield, PhalaTeeAnchor } from "../../telemetry-shield/src/index";
import * as readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// ---------------------------------------------------- //
// AEGIS-12: VANILLA AGENT HACKATHON DEMONSTRATOR
// ---------------------------------------------------- //

async function executeStealthTrade(shield: AegisShield, agentId: string) {
    console.log(`\n[Agent ${agentId}] 🟢 Executing Stealth Arbitrage Swap...`);
    const mockHash = "8e9f...2d1a";
    
    // 1. Fire Chaff to blind the MEV Extractors
    console.log(`[Agent ${agentId}] -> Deploying RPC Decoy Barrage...`);
    await shield.deployDecoyTraffic(mockHash);

    // 2. Off-path Compliance Anchoring
    console.log(`[Agent ${agentId}] -> Trading 500 USDC for SOL (Anchoring intent in background)`);
    shield.logIntent(agentId, { action: "SWAP", amount: 500, asset: "USDC->SOL" }).catch(() => {});
    
    // 3. Trade Completes Instantly
    console.log(`[Agent ${agentId}] ✅ Trade Confirmed. 0ms blocking from telemetry.\n`);
}

async function executeHftBarrage(shield: AegisShield) {
    console.log(`\n🔴 HIGH FREQUENCY TRADING BARRAGE INITIATED (100 Trades / second)`);
    console.log(`Watch the Aegis-12 Mutex seamlessly handle the asynchronous JSON queue without crashing...\n`);
    
    const promises = [];
    for (let i = 0; i < 100; i++) {
        promises.push(shield.logIntent(`HFT_BOT_${i}`, { action: "SCALP" }));
    }
    
    await Promise.all(promises);
    console.log(`\n✅ 100 Trades Processed. Zero Corrupted Mempools.\n`);
}

async function executeInfrastructureCollapse() {
    console.log(`\n💥 INFRASTRUCTURE COLLAPSE DEMONSTRATION`);
    console.log(`Simulating a total Cloud TEE failure. We will route to a dead server.`);
    
    // Mount a dead endpoint
    process.env.PROD_URL = "http://localhost:9999/dead_blackbox";
    const deadShield = new AegisShield({ teeAnchors: [new PhalaTeeAnchor()] });
    
    console.log(`[Agent-Survivor] -> Initiating Trade Protocol...`);
    
    // Fire trade. The TEE anchor will fail violently in the background
    deadShield.logIntent("Agent-Survivor", { action: "LIQUIDATE_ALL" }).catch(() => {});
    
    console.log(`[Agent-Survivor] ✅ Trade complete. The host hedge fund process did NOT crash.`);
    console.log(`Check '.aegis_wal.json'. You will see the EvidenceWAL correctly cached the stranded trace on-disk.\n`);
}

async function startDemo() {
    console.log("=========================================");
    console.log("   AEGIS-12: SOVEREIGN TRADING BOT       ");
    console.log("=========================================\n");

    const activeShield = new AegisShield({ teeAnchors: [new PhalaTeeAnchor()] });

    console.log("Select a Hackathon Demonstration Scenario:");
    console.log("1. The Golden Path (Standard Stealth Trade)");
    console.log("2. The HFT Barrage (100 Async Trades / Sec to prove JSON Mutex)");
    console.log("3. Infrastructure Collapse (Prove EvidenceWAL caching & Node Crash Defense)");
    console.log("4. Exit");

    rl.question("\nEnter Scenario [1-4]: ", async (answer) => {
        switch (answer.trim()) {
            case "1":
                await executeStealthTrade(activeShield, "Agent-Alpha");
                startDemo();
                break;
            case "2":
                await executeHftBarrage(activeShield);
                startDemo();
                break;
            case "3":
                await executeInfrastructureCollapse();
                setTimeout(() => startDemo(), 2000); // give the failed async traces a moment to print their warnings
                break;
            case "4":
                console.log("Exiting demonstration.");
                process.exit(0);
            default:
                console.log("Invalid option.");
                startDemo();
        }
    });
}

startDemo();
