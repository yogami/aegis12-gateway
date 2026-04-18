/**
 * AEGIS-12 MINIMAL INTEGRATION EXAMPLE
 * 
 * This snippet shows how to wrap a standard Solana agent transaction 
 * in an Aegis-12 hardware-enforced policy request.
 */

async function enforceAegisPolicy(agentAction: any) {
    const GATEWAY_URL = 'https://aegis12-gateway-production.up.railway.app/enforce';

    const payload = {
        agent: {
            id: "your_agent_id",
            purpose: "DEFI_TRADING",
            tenantId: "your_tenant_id",
            walletAddress: "0x..." 
        },
        action: agentAction, // e.g., { toolId: "swap", parameters: { ... } }
        context: {
            timestamp: new Date().toISOString(),
            currentAnomalyScore: 0.05 // Feed your internal risk score here
        },
        dynamicPolicy: {
            // Your cryptographically signed policy config goes here
            // This ensures the TEE enclave honors your specific limits.
            signature: "0x...", 
            policyConfig: { /* ... */ }
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
            amount: 100
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
