import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";

export const evaluateIntentAction: any = {
    name: "EVALUATE_INTENT",
    similes: ["EXECUTE_COMPLIANT_TRANSFER", "AEGIS_TRANSFER", "SEND_FUNDS_SECURELY"],
    description: "Intercepts a financial transaction and routes it through the Aegis-12 TEE Gateway for policy enforcement.",
    
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        // Validate if there's an intent to transfer funds
        const content = typeof message.content === 'string' ? message.content : message.content?.text || '';
        return content.toLowerCase().includes("transfer") || content.toLowerCase().includes("send");
    },
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            // Extract parameters (Mocked extraction for the demo)
            // In a real plugin, we would use an LLM extraction template here.
            const text = typeof message.content === 'string' ? message.content : message.content?.text || '';
            
            // Basic mock parsing: "transfer 50000 USDC to Target"
            const amountMatch = text.match(/(\d+)\s*(USDC|SOL)/i);
            const amount = amountMatch ? parseInt(amountMatch[1]) * 1000000 : 1000000;
            
            const payload = {
                agent: { 
                    did: runtime.agentId || "did:aegis:eliza-agent", 
                    purpose: "financial_operations", 
                    currentTier: "T4" 
                },
                action: { 
                    toolId: "solana_transfer", 
                    actionType: "transfer", 
                    parameters: { 
                        to: "TargetAddress", 
                        amount: amount, 
                        token: "USDC" 
                    } 
                },
                context: { 
                    sessionId: "eliza-session-" + Date.now(), 
                    actionsThisSession: 1, 
                    actionsThisHour: 1, 
                    currentAnomalyScore: 0.1, 
                    recentIncidents: 0,
                    currentSlot: 2000000
                },
                dynamicPolicy: {
                    policyConfig: {
                        policyId: "p-eliza-demo",
                        tenantId: "tenant-eliza",
                        version: "1.0.0",
                        chainId: 1399811149,
                        crossChainTarget: "solana:devnet",
                        maxAnomalyScore: 100,
                        financialLimitsString: JSON.stringify({ "T4": 10000 }), // 10k limit
                        expiresAt: Math.floor(Date.now() / 1000) + 3600,
                        nonce: "nonce-" + Date.now(),
                        vaultPda: "AegisVault_Demo",
                        squadsMultisig: "SquadsMultisig_Demo",
                        allowedProgramIds: ["TargetProgramId_Demo"]
                    },
                    ownerPublicKey: "MockOwnerPubKey",
                    signature: "MockSignature"
                }
            };

            const aegisUrl = process.env.AEGIS_GATEWAY_URL || "http://localhost:8000";
            
            if (callback) {
                 callback({
                     text: `Routing intent through Aegis-12 TEE Gateway at ${aegisUrl}...`,
                     action: "EVALUATE_INTENT"
                 });
            }

            const response = await fetch(`${aegisUrl}/enforce`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Aegis Gateway Error: ${errText}`);
            }

            const result = await response.json();

            if (result.status === 'escalated') {
                const envelope = result.receipt?.envelope;
                if (callback) {
                    callback({
                        text: `⚠️ ACTION HALTED: Article 14 Human-On-The-Loop triggered. Amount (${amount} USDC) exceeds autonomous threshold. 
Cryptographic Intent Envelope Generated.
Vault PDA: ${envelope?.vault_pda}
Valid Until Slot: ${envelope?.state_predicates?.valid_until_slot}
Waiting for Multisig Threshold...`,
                        action: "EVALUATE_INTENT",
                        content: result
                    });
                }
                return true;
            }

            if (result.status === 'denied') {
                const trustScoreImpact = result.veraTrustScore ? `\n📉 VERA Trust Score Impact: Slashed to ${result.veraTrustScore}` : `\n📉 VERA Trust Score: Slashed`;
                if (callback) {
                    callback({
                        text: `❌ ACTION DENIED: Aegis TEE Gateway rejected the transaction. Reason: ${result.error || result.decisionReason}${trustScoreImpact}`,
                        action: "EVALUATE_INTENT"
                    });
                }
                return true;
            }

            if (callback) {
                callback({
                    text: `✅ ACTION APPROVED. TEE Hardware Quote Verified. Transaction executed with Ledger Anchor: ${result.ledger_tx} and ZK Seal: ${result.ars_anchor}`,
                    action: "EVALUATE_INTENT",
                    content: result
                });
            }

            return true;
        } catch (error: any) {
            if (callback) {
                callback({
                    text: `Fatal execution error: ${error.message}`,
                    action: "EVALUATE_INTENT"
                });
            }
            return false;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Transfer 50000 USDC to the operational wallet." }
            },
            {
                user: "{{agentName}}",
                content: { text: "I am routing your 50000 USDC transfer through the Aegis-12 compliance gateway.", action: "EVALUATE_INTENT" }
            }
        ]
    ]
};
