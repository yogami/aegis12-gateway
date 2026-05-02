import { ethers } from 'ethers';
import { PolicyEvaluationRequest } from '../types';

export class Eip712Verifier {
    public static verifySignature(policy: NonNullable<PolicyEvaluationRequest['dynamicPolicy']>, tenantTrustStore: Record<string, string[]>, domainName: string, domainVersion: string, chainId: number): void {
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
                { name: "nonce", type: "string" },
                { name: "vaultPda", type: "string" },
                { name: "squadsMultisig", type: "string" },
                { name: "allowedProgramIds", type: "string[]" }
            ]
        };



        const signerAddress = ethers.utils.verifyTypedData(domain, types, policy.policyConfig, policy.signature).toLowerCase();
        const authorized = (tenantTrustStore[policy.policyConfig.tenantId] || []).map(a => a.toLowerCase());
        if (!authorized.includes(signerAddress)) {
            if (process.env.NODE_ENV !== 'production') {
                console.error(`[Aegis-12 DEBUG] tenantTrustStore: ${JSON.stringify(tenantTrustStore)}`);
                console.error(`[Aegis-12 DEBUG] policy tenantId: ${policy.policyConfig.tenantId}`);
            }
            throw new Error(`Signer not found in provisioned TEE Root-of-Trust. Found: ${signerAddress}`);
        }

        const cluster = process.env.SOLANA_CLUSTER || 'devnet';
        const expectedCrossChainTarget = cluster === 'mainnet-beta' ? 'solana-mainnet' : `solana:${cluster}`;
        if (policy.policyConfig.crossChainTarget !== expectedCrossChainTarget) {
            throw new Error(`[TERMINAL REFUSAL] crossChainTarget mismatch. Expected ${expectedCrossChainTarget}, got ${policy.policyConfig.crossChainTarget}.`);
        }
    }

    public static verifyReceipt(receipt: any, enclaveAddress: string, domainName: string, domainVersion: string, chainId: number): boolean {
        const domain = { name: domainName, version: domainVersion, chainId: chainId };
        const types = {
            AegisComplianceReceipt: [
                { name: 'receiptId', type: 'string' }, { name: 'actionId', type: 'string' }, { name: 'toolId', type: 'string' },
                { name: 'agentPubKey', type: 'string' }, { name: 'article12LogHash', type: 'string' }, { name: 'parametersHash', type: 'string' },
                { name: 'resultHash', type: 'string' }, { name: 'article14OversightSignature', type: 'string' }, { name: 'policyId', type: 'string' },
                { name: 'tenantId', type: 'string' }, { name: 'complianceStandard', type: 'string' }, { name: 'authorizationNonce', type: 'string' },
                { name: 'timestamp', type: 'string' }, { name: 'validatedParamsJson', type: 'string' }, { name: 'limitationsJson', type: 'string' },
                { name: 'zkSeal', type: 'string' }
            ]
        };

        const signable = {
            ...receipt,
            validatedParamsJson: JSON.stringify(receipt.validatedParams, (key, value) => typeof value === 'bigint' ? value.toString() : value),
            limitationsJson: JSON.stringify(receipt.limitations),
            zkSeal: (receipt as any).zkSeal || "none"
        };

        const signerAddress = ethers.utils.verifyTypedData(domain, types, signable, receipt.signature).toLowerCase();
        return signerAddress === enclaveAddress.toLowerCase();
    }
}
