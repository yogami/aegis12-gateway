/**
 * AEGIS-12 MINIMAL INTEGRATION EXAMPLE
 * 
 * This snippet shows how to wrap a standard Solana agent transaction 
 * in an Aegis-12 hardware-enforced policy request.
 */

async function enforceAegisPolicy(agentAction: any) {
    const GATEWAY_URL = 'http://localhost:8000/enforce';

    const payload = {
        agent: {
            id: "your_agent_id",
            purpose: "DEFI_TRADING",
            tenantId: "tenant-council",
            currentTier: "T4",
            walletAddress: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A" 
        },
        action: agentAction, // e.g., { toolId: "swap", parameters: { ... } }
        context: {
            timestamp: new Date().toISOString(),
            currentAnomalyScore: 0.05 // Feed your internal risk score here
        },
        dynamicPolicy: {
            // Using demo-bypass for the minimal example
            signature: "demo-bypass-signature", 
            policyConfig: {
                policyId: "demo-policy-1",
                tenantId: "tenant-council",
                version: "1.0",
                chainId: 1399811149,
                crossChainTarget: "solana:devnet",
                nonce: Date.now().toString(),
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                maxAnomalyScore: 50,
                financialLimitsString: JSON.stringify({ "T4": 1000000 })
            }
        }
    };

    const response = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    return await response.json();
}

// USAGE EXAMPLE:
async function myAgentTrade() {
    const tradeAction = {
        toolId: "swap",
        parameters: {
            fromMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
            toMint: "So11111111111111111111111111111111111111112", // SOL
            amount: 100,
            slippageBps: 50
        }
    };

    console.log("🛡️ Checking Aegis-12 Hardware Kill Switch...");
    const decision = await enforceAegisPolicy(tradeAction);

    if (decision.status === "approved") {
        console.log("✅ Approved. Solana Explorer Link:", decision.explorer_url);
        // PROCEED TO SIGN AND BROADCAST ON SOLANA
    } else {
        console.log("❌ BLOCKED by TEE Hardware Enclave. Reason:", decision.error);
        // STOP EXECUTION IMMEDIATELY
    }
}

myAgentTrade();
