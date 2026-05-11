import { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { AegisSDK } from "../../../aegis12-sdk/src/AegisSDK";

export const evaluateIntentAction: Action = {
    name: "EVALUATE_INTENT",
    similes: ["EXECUTE_COMPLIANT_TRANSFER", "AEGIS_TRANSFER", "SEND_FUNDS_SECURELY"],
    description: "Intercepts a financial transaction and routes it through the Aegis-12 TEE Fiduciary Firewall.",
    
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const content = typeof message.content === 'string' ? message.content : message.content?.text || '';
        const text = content.toLowerCase();
        return (text.includes("transfer") || text.includes("send")) && 
               (text.includes("usdc") || text.includes("sol") || text.includes("funds"));
    },
    
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        options?: any,
        callback?: HandlerCallback
    ) => {
        try {
            // Extract parameters dynamically instead of hardcoding
            const text = typeof message.content === 'string' ? message.content : message.content?.text || '';
            const amountMatch = text.match(/([\d.]+)\s*(USDC|SOL)/i);
            const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
            
            // Extract Solana address strictly after "to "
            const addressMatch = text.match(/(?:to\s+)([1-9A-HJ-NP-Za-km-z]{32,44})/i);
            const toAddress = addressMatch ? addressMatch[1] : null;

            if (!toAddress || amount <= 0) {
                if (callback) {
                    callback({
                        text: "❌ ACTION HALTED: Could not extract a valid destination address or amount from the intent.",
                        action: "EVALUATE_INTENT"
                    });
                }
                return false;
            }
            
            const unsignedIntent = {
                toolId: "solana_transfer", 
                parameters: { 
                    to: toAddress, 
                    amount: amount, 
                    token: amountMatch ? amountMatch[2].toUpperCase() : "USDC" 
                } 
            };

            const aegisUrl = process.env.AEGIS_GATEWAY_URL || "http://localhost:8000";
            const mandateSignature = process.env.AEGIS_MANDATE_SIGNATURE;
            
            if (!mandateSignature || mandateSignature === "MockSignature") {
                if (callback) {
                    callback({
                        text: "❌ ACTION HALTED: Fiduciary Escrow is not configured. AEGIS_MANDATE_SIGNATURE is missing.",
                        action: "EVALUATE_INTENT"
                    });
                }
                return false;
            }

            // Using the Fiduciary Firewall SDK
            const result = await AegisSDK.signAndExecute(unsignedIntent, {
                agentId: runtime.agentId || "did:aegis:eliza-agent",
                tenantId: runtime.getSetting("AEGIS_TENANT_ID") || "default-tenant",
                mandateSignature: mandateSignature,
                gatewayUrl: aegisUrl
            });

            if (result.status === 'escalated') {
                const envelope = result.envelope;
                if (callback) {
                    callback({
                        text: `⚠️ ACTION HALTED: Article 14 Human-On-The-Loop triggered. Amount (${amount} USDC) exceeds autonomous threshold. 
Cryptographic Intent Envelope Generated.
Waiting for Squads V4 Multisig Threshold...`,
                        action: "EVALUATE_INTENT",
                        content: result
                    });
                }
                return true;
            }

            if (callback) {
                callback({
                    text: `✅ ACTION APPROVED. Proof of Intent (PoI) Verified. Transaction executed with Ledger Anchor: ${result.tx_hash} and Hardware Attestation: ${result.hardware_attestation}`,
                    action: "EVALUATE_INTENT",
                    content: result
                });
            }

            return true;
        } catch (error: any) {
            if (callback) {
                callback({
                    text: `❌ ACTION DENIED: Aegis Fiduciary Escrow rejected the transaction. Reason: ${error.message}`,
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
                content: { text: "I am routing your 50000 USDC transfer through the Aegis Fiduciary Firewall.", action: "EVALUATE_INTENT" }
            }
        ]
    ]
};
