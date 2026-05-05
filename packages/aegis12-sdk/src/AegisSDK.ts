import fetch from 'node-fetch';
import { ethers } from 'ethers';

export interface AegisConfig {
    gatewayUrl?: string; // Defaults to the live Railway proxy
    agentId: string;
    tenantId: string;
    agentTier?: string;
    timeoutMs?: number;
    policySignature: string;
    currentAnomalyScore?: number;
}

export interface AegisPolicyConfig {
    policyId: string;
    tenantId: string;
    version: string;
    chainId: number;
    crossChainTarget: string;
    maxAnomalyScore: number;
    financialLimitsString: string;
    expiresAt: number;
    nonce: string;
    vaultPda: string;
    squadsMultisig: string;
    allowedProgramIds: string[];
}

export class AegisSDK {
    /**
     * Utility to cryptographically sign a strict Aegis EIP-712 Policy.
     * Use this during agent initialization to generate the policy envelope required by the TEE Enclave.
     */
    static async createPolicySignature(
        privateKey: string,
        policyConfig: AegisPolicyConfig,
        domainName = 'Aegis-12',
        domainVersion = '1'
    ): Promise<string> {
        const domain = { name: domainName, version: domainVersion, chainId: policyConfig.chainId };
        const types = {
            Policy: [
                { name: "policyId", type: "string" },
                { name: "tenantId", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "crossChainTarget", type: "string" },
                { name: "maxAnomalyScore", type: "uint256" },
                { name: "financialLimitsString", type: "string" },
                { name: "expiresAt", type: "uint256" },
                { name: "nonce", type: "string" },
                { name: "vaultPda", type: "string" },
                { name: "squadsMultisig", type: "string" },
                { name: "allowedProgramIds", type: "string[]" }
            ]
        };

        const wallet = new ethers.Wallet(privateKey);
        // _signTypedData is used in ethers v5 for EIP-712
        return await wallet._signTypedData(domain, types, policyConfig);
    }

    /**
     * withAegis — The Drop-in SDK wrapper for hardware compliance.
     * Wraps an agent's intended action and ensures it is verified by the Phala TEE Gateway.
     */
    static withAegis(action: Function, config: AegisConfig) {
        if (!config.policySignature || config.policySignature.length < 10) {
            throw new Error('[Aegis SDK] policySignature is required. The gateway will reject requests without a valid EIP-712 signature.');
        }

        const gatewayUrl = config.gatewayUrl || 'https://aegis12-dashboarduprailwayapp-production.up.railway.app/api';

        return async (...args: any[]) => {
            const timeoutMs = config.timeoutMs || 5000;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            try {
                // Execute the agent action to get its intent (tool and parameters)
                const agentAction = await action(...args);
                
                // Construct the payload required by the Aegis-12 Gateway
                const payload = {
                    agent: {
                        id: config.agentId,
                        tenantId: config.tenantId,
                        currentTier: config.agentTier || 'T1'
                    },
                    action: {
                        toolId: agentAction.toolId || 'unknown',
                        parameters: agentAction.parameters || agentAction
                    },
                    context: {
                        timestamp: new Date().toISOString(),
                        currentAnomalyScore: config.currentAnomalyScore ?? 0.5
                    },
                    dynamicPolicy: {
                        signature: config.policySignature,
                        policyConfig: {
                            policyId: `${config.tenantId}-policy`,
                            tenantId: config.tenantId,
                            nonce: Date.now().toString(),
                            // Hackathon default expiration (1 hour)
                            expiresAt: Math.floor(Date.now() / 1000) + 3600,
                            financialLimitsString: "{}",
                            // Required EIP-712 fields matching the backend schema
                            version: "1",
                            chainId: 1, // Usually Ethereum Mainnet for signing
                            crossChainTarget: "solana:devnet",
                            maxAnomalyScore: 100, // Very lenient for hackathons
                            vaultPda: "11111111111111111111111111111111",
                            squadsMultisig: "11111111111111111111111111111111",
                            allowedProgramIds: []
                        }
                    }
                };

                const response = await fetch(`${gatewayUrl}/enforce`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal as any
                });

                clearTimeout(timeout);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown Gateway Error' })) as any;
                    throw new Error(`Aegis Enforcement Rejected: ${errorData.error || response.statusText}`);
                }

                const decision = await response.json() as any;
                
                // Fail-closed enforcement on the SDK side just in case
                if (decision.status !== 'approved') {
                    throw new Error(`Aegis Enforcement Denied: ${decision.error || 'Policy Violation'}`);
                }

                return {
                    ...agentAction,
                    decision: 'ALLOW',
                    receipt: decision.receipt,
                    solanaTx: decision.solana_tx,
                    hardware_attestation: decision.hardware
                };

            } catch (err: any) {
                clearTimeout(timeout);
                // Fail-closed: if gateway is unreachable or denied, the action throws.
                throw err;
            }
        };
    }
}
