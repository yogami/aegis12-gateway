import { ethers } from 'ethers';
import { DynamicPolicyPayload } from '../types';

// --- HARDCODED TEE CONSTANTS (never sourced from attacker payload) ---
const AEGIS_CHAIN_ID = 1399811149; // Solana Mainnet EIP-155
const AEGIS_DOMAIN_NAME = "Aegis-12-Compliance-Matrix";
const AEGIS_DOMAIN_VERSION = "1.0.0";

export class Eip712Verifier {
    /**
     * Authenticates the specific dynamic policy against the EIP-712 standard constraints
     * and strictly asserts the recovered address is present in the TEE Tenant Trust Store.
     * 
     * @throws {Error} if the signature is invalid, forged, or expired.
     */
    public static verifySignature(dynamicPolicy: DynamicPolicyPayload, trustStore: Record<string, readonly string[]>): void {
        const domain = {
            name: AEGIS_DOMAIN_NAME,
            version: AEGIS_DOMAIN_VERSION,
            chainId: AEGIS_CHAIN_ID
        };

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

        const value = {
            policyId: dynamicPolicy.policyConfig.policyId,
            tenantId: dynamicPolicy.policyConfig.tenantId,
            version: AEGIS_DOMAIN_VERSION,
            chainId: AEGIS_CHAIN_ID,
            crossChainTarget: dynamicPolicy.policyConfig.crossChainTarget,
            maxAnomalyScore: dynamicPolicy.policyConfig.maxAnomalyScore,
            financialLimitsString: dynamicPolicy.policyConfig.financialLimitsString || "{}",
            expiresAt: dynamicPolicy.policyConfig.expiresAt,
            nonce: dynamicPolicy.policyConfig.nonce
        };

        // --- COUNCIL GATE FIX: EXPLICIT DOMAIN & CHAIN BINDING ---
        // Assert the payload targeting matches our TEE deployment manifest
        if (dynamicPolicy.policyConfig.chainId !== AEGIS_CHAIN_ID || dynamicPolicy.policyConfig.version !== AEGIS_DOMAIN_VERSION) {
            throw new Error(`[TERMINAL REFUSAL] Policy Target Mismatch: TEE enclave expects version ${AEGIS_DOMAIN_VERSION} on Chain ${AEGIS_CHAIN_ID}.`);
        }

        const recoveredAddress = ethers.utils.verifyTypedData(domain, types, value, dynamicPolicy.signature);

        // --- ROOT OF TRUST ASSERTION ---
        const tenantId = dynamicPolicy.policyConfig.tenantId;
        const authorizedKeys = trustStore[tenantId];
        
        if (!authorizedKeys || !authorizedKeys.some(k => k.toLowerCase() === recoveredAddress.toLowerCase())) {
            throw new Error('Cryptographic Failure: Signer not found in provisioned TEE Root-of-Trust (Policy Forgery Attempt).');
        }

        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime > dynamicPolicy.policyConfig.expiresAt) {
            throw new Error('[TERMINAL REFUSAL] Policy Expired (Replay Attack Detected). Valid time window has closed.');
        }
    }
}
