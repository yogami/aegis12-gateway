import { AegisSigner } from '../src/infrastructure/AegisSigner';
import fetch from 'node-fetch';

const GATEWAY_URL = 'http://localhost:8000/enforce';
const signer = new AegisSigner();

// Helper to sleep for dramatic effect
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runDemo() {
    console.log("\n========================================================");
    console.log("🤖 STARTING AUTONOMOUS AGENT (DeFi Sniper Bot v4.2)");
    console.log("========================================================\n");
    await sleep(1000);

    // ------------------------------------------------------------------------
    // SCENARIO 1: SAFE TRADE (UNDER POLICY LIMIT)
    // ------------------------------------------------------------------------
    console.log("🟢 [AGENT]: Identified arbitrage opportunity on Raydium.");
    console.log("🟢 [AGENT]: Proposing swap of 500 USDC -> SOL...");
    await sleep(1500);

    const safePayload = {
        agent: {
            id: "bot_alpha_99",
            purpose: "DEFI_TRADING",
            clearanceLevel: 3,
            currentTier: "TIER_3",
            tenantId: "tenant-council",
            walletAddress: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A"
        },
        action: {
            toolId: "swap",
            targetProtocol: "RAYDIUM",
            parameters: {
                fromMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
                toMint: "So11111111111111111111111111111111111111112", // SOL
                amount: 500, // Safe amount
                slippageBps: 100
            }
        },
        context: {
            network_state: "devnet_live",
            timestamp: new Date().toISOString(),
            currentAnomalyScore: 0.1 // Normal behavior
        },
        dynamicPolicy: {
            signature: "demo-bypass-signature",
            strictEnforcement: true,
            maxSlippage: 0.01,
            allowedProtocols: ["RAYDIUM", "ORCA"],
            policyConfig: {
                policyId: "demo-policy-1",
                tenantId: "tenant-council",
                nonce: Date.now(),
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                maxAnomalyScore: 50,
                financialLimitsString: JSON.stringify({ "TIER_3": 1000000 }),
                limits: { spendVelocityLimits: { dailyLimit: 1000000, perTxLimit: 50000 } }
            }
        }
    };

    console.log("📡 [GATEWAY]: Routing payload to Aegis-12 Phala TEE Enclave...");
    
    try {
        const res1 = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(safePayload)
        });
        const data1 = await res1.json();

        if (data1.status === "approved") {
            console.log("🛡️ [TEE ENCLAVE]: Identity Verified. Spend Velocity: OK. Anomaly: OK.");
            console.log("✅ [GATEWAY]: Decision -> ALLOW");
            console.log(`🔗 [SOLANA ANCHOR]: Spl Memo Written -> ${data1.solana_tx}`);
            console.log(`🌍 [EXPLORER]: ${data1.explorer_url}`);
            console.log("💰 [AGENT]: Executing trade on-chain.\n");
        } else {
            console.log("❌ [GATEWAY ERROR]: Unexpected denial:", data1);
        }
    } catch (e: any) {
        console.log("❌ [GATEWAY FATAL]: Could not reach enclave. Is the server running?");
        return;
    }

    await sleep(3000);

    // ------------------------------------------------------------------------
    // SCENARIO 2: ROGUE AGENT (SPEND VELOCITY BREACH / HACKED)
    // ------------------------------------------------------------------------
    console.log("========================================================");
    console.log("🚨 [THREAT DETECTED]: Agent prompt injection suspected.");
    console.log("🚨 [AGENT]: Attempting to drain wallet to unknown address.");
    console.log("🔴 [AGENT]: Proposing swap of 9,999,999 USDC -> SOL...");
    console.log("========================================================\n");
    await sleep(2000);

    const roguePayload = { ...safePayload };
    roguePayload.action.parameters.amount = 99999999; // Malicious spend attempt
    roguePayload.dynamicPolicy.policyConfig.nonce = Date.now() + 1; // new nonce
    roguePayload.context.currentAnomalyScore = 0.85; // High anomaly context

    console.log("📡 [GATEWAY]: Intercepting rogue payload to Aegis-12 Phala TEE...");
    
    try {
        const res2 = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roguePayload)
        });
        const data2 = await res2.json();

        if (data2.status === "denied") {
            console.log("🛡️ [TEE ENCLAVE]: Hardware Panic! Cumulative spend would exceed hardware-locked lifetime ceiling!");
            console.log("❌ [GATEWAY]: SOVEREIGN KILL SWITCH ACTIVATED -> BLOCK");
            console.log(`🛑 Reason: ${data2.error}`);
            console.log(`⛓️ [SOLANA ANCHOR]: Denial receipt immutably anchored on-chain!`);
            console.log(`📝 [SIGNATURE]: ${data2.solana_tx}`);
            console.log(`🌍 [EXPLORER]: ${data2.explorer_url}\n`);
            console.log("🔒 [OUTCOME]: Liquidity saved. Attack thwarted. Cryptographic proof secured.");
        } else {
            console.log("⚠️ [CRITICAL ERROR]: Gateway allowed malicious transaction!", data2);
        }
    } catch (e: any) {
        console.log("❌ [GATEWAY FATAL]: Could not reach enclave.", e.message);
    }
}

runDemo();
