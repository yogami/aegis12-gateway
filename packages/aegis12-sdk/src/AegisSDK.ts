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
     * @deprecated The 'withAegis' wrapper is deprecated. Agents must not hold private keys.
     * Use 'signAndExecute' instead for the Zero-Custody TEE Facilitator model.
     */
    static withAegis(action: Function, config: AegisConfig) {
        throw new Error('[Aegis SDK] withAegis is deprecated. You must use signAndExecute. Agents cannot hold private keys.');
    }

    /**
     * signAndExecute — The Drop-in SDK for the TEE Remote Signer.
     * The agent passes an unsigned intent. The Phala TEE evaluates the policy, signs the transaction securely,
     * submits via Jito ShredStream, and returns the tx_hash and Evidence Package.
     */
    static async signAndExecute(intent: any, config: AegisConfig) {
        const gatewayUrl = config.gatewayUrl || 'https://aegis12-dashboarduprailwayapp-production.up.railway.app/api';
        const timeoutMs = config.timeoutMs || 5000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const payload = {
                agent: {
                    id: config.agentId,
                    tenantId: config.tenantId,
                    currentTier: config.agentTier || 'T1'
                },
                action: {
                    toolId: intent.toolId || 'unsigned_transaction',
                    parameters: intent.parameters || intent
                },
                context: {
                    timestamp: new Date().toISOString(),
                    currentAnomalyScore: config.currentAnomalyScore ?? 0.5
                }
            };

            const response = await fetch(`${gatewayUrl}/sign_and_execute`, {
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
            
            if (decision.status !== 'approved' && decision.status !== 'escalated') {
                throw new Error(`Aegis Enforcement Denied: ${decision.error || 'Policy Violation'}`);
            }

            return {
                status: decision.status,
                decision: 'ALLOW',
                tx_hash: decision.tx_hash,
                evidence_package: decision.evidence_package,
                hardware_attestation: decision.hardware_quote,
                envelope: decision.envelope
            };

        } catch (err: any) {
            clearTimeout(timeout);
            throw err;
        }
    }
}
