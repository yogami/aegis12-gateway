import { ethers } from 'ethers';
import { DynamicPolicy } from '../types';

export class Eip712Verifier {
    public static verifySignature(policy: DynamicPolicy, tenantTrustStore: Record<string, string[]>, domainName: string, domainVersion: string, chainId: number): void {
        const domain = { name: domainName, version: domainVersion, chainId: chainId };
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

        const signerAddress = ethers.utils.verifyTypedData(domain, types, policy.policyConfig, policy.signature);
        const authorized = tenantTrustStore[policy.policyConfig.tenantId] || [];
        if (!authorized.includes(signerAddress)) {
            throw new Error(`Signer not found in provisioned TEE Root-of-Trust. Found: ${signerAddress}`);
        }
    }
}
