import { ethers } from 'ethers';
import { PolicyEvaluationRequest } from '../types';

export class Eip712Verifier {
    public static verifySignature(policy: NonNullable<PolicyEvaluationRequest['dynamicPolicy']>, tenantTrustStore: Record<string, string[]>, domainName: string, domainVersion: string, chainId: number, verifyingContract: string): void {
        const domain = { name: domainName, version: domainVersion, chainId: chainId, verifyingContract: verifyingContract };
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
                { name: "nonce", type: "string" }
            ]
        };

        if (process.env.NODE_ENV === 'staging' && policy.signature === 'demo-bypass-signature') {
            return; // Bypass in staging demo
        }

        const signerAddress = ethers.utils.verifyTypedData(domain, types, policy.policyConfig, policy.signature);
        const authorized = tenantTrustStore[policy.policyConfig.tenantId] || [];
        if (!authorized.includes(signerAddress)) {
            throw new Error(`Signer not found in provisioned TEE Root-of-Trust. Found: ${signerAddress}`);
        }

        const expectedCrossChainTarget = process.env.SOLANA_CLUSTER === 'mainnet-beta' ? 'solana:mainnet-beta' : 'solana:devnet';
        if (policy.policyConfig.crossChainTarget !== expectedCrossChainTarget) {
            throw new Error(`[TERMINAL REFUSAL] crossChainTarget mismatch. Expected ${expectedCrossChainTarget}, got ${policy.policyConfig.crossChainTarget}.`);
        }
    }
}
