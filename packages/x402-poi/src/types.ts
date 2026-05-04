/**
 * Types for the Aegis-12 x402 Policy Engine
 */

export interface EvidencePackage {
    policyId: string;
    riskTier: string;
    modelVersion: string;
    jurisdiction: string;
    actionTaxonomy: string;
    intentHash: string; // Cryptographic hash of prompt + context + reasoning
    timestamp: number;
}

export interface PoIAttestationHeader {
    evidence: EvidencePackage;
    enclaveSignature: string; // The sub-50ms signature from the Phala CVM
    zkAnchoringStatus: 'pending' | 'verified'; // Always 'pending' inline; verified async
}

export interface AegisConfig {
    enclaveEndpoint: string;
    apiKey: string;
    policyId: string;
}
