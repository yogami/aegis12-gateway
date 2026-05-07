// types.ts
// Ported from pdp-protocol/src/vera/types.ts for Aegis TEE Enclave

export interface SolanaTransferPayload {
    to: string;
    amount: number;
}

export interface SwapPayload {
    fromMint: string;
    toMint: string;
    amount: number;
    slippageBps: number;
}

export type ISO8601 = string; // e.g. "2026-02-27T12:00:00Z"

export enum TrustTier {
    T1 = 'T1', // Observer
    T2 = 'T2', // Advisor
    T3 = 'T3', // Operator
    T4 = 'T4', // Autonomous (Aegis Focus)
}

export enum AgentPurpose {
    FINANCIAL_OPERATIONS = 'financial_operations', // Aegis Focus
}

export interface PolicyDecision {
    decision: 'allow' | 'deny' | 'escalate';
    obligations?: PolicyObligation[];
    ttl: number;                    // Decision cache TTL in seconds
    reason: string;
}

export interface PolicyObligation {
    type: 'redact_fields' | 'require_approval' | 'step_up_auth'
    | 'rate_limit' | 'read_only_mode' | 'max_value_limit'
    | 'log_level_increase';
    parameters: Record<string, unknown>;
}

/**
 * The canonical payload generated when the TEE decides to ESCALATE.
 * This binds the exact execution environment (state predicates) to the
 * TEE's attestation, preventing State Drift and UI Spoofing.
 */
export interface AegisIntentEnvelope {
    domain_separator: string; // e.g. "AEGIS12_ESCALATE_V1"
    vault_pda: string;
    squads_multisig: string;
    instruction_digest: string; // The canonical hash of the intended Solana instruction
    state_predicates: {
        max_input_amount: number;
        allowed_program_ids: string[];
        valid_until_slot: number; // The Expiration Epoch
    };
    policy_hash: string;
    tee_signature?: string; // The Ed25519 signature from the Phala TEE
}

export interface EvidencePackage {
    policyId: string;
    riskTier: string;
    modelVersion: string;
    jurisdiction: string;
    actionTaxonomy: string;
    intentHash: string;
    timestamp: number;
}

/**
 * AegisComplianceReceipt (v1.0.0)
 * 
 * [EU AI ACT COMPLIANCE]
 * This structure fulfills the transparency and traceability requirements of 
 * Article 12 (Traceable Logging) and Article 14 (Human Oversight).
 */

export interface AegisComplianceReceipt {
    receiptId: string;              // Unique time-ordered identifier (UUID v7)
    actionId: string;               // Link to Proof of Execution actionId
    toolId: string;                 // The tool's unique SPIFFE or DID
    agentPubKey: string;            // The Solana/Phala identity of the agent
    
    // --- ARTICLE 12: TRACEABLE LOGGING ---
    article12LogHash: string;       // Keccak-256 hash of (params + result + context)
    parametersHash: string;         // Hash of sanitized parameters
    resultHash: string;             // Hash of the execution output
    
    // --- ARTICLE 14: HUMAN OVERSIGHT ---
    article14OversightSignature: string; // The EIP-712 human-authorized policy signature
    policyId: string;               // Reference to the active policy
    tenantId: string;               // The human owner (Trust-at-the-Root)
    
    // --- COMPLIANCE DESCRIPTOR ---
    complianceStandard: "ARS-01+" | "ERC-8004" | "CUSTOM";
    limitations: string[];          // "Honest Sentinel" declarations of TEE observation gaps
    
    authorizationNonce: string;     // Irrevocable nonce (burned at execution)
    validatedParams?: Record<string, unknown>; // [AUDIT-GRADE] Sanitized whitelisted parameters
    decision: 'approved' | 'denied' | 'escalated'; // [AUDIT-GRADE] The final gateway decision
    envelope?: AegisIntentEnvelope; // [ARTICLE 14] The cryptographically bound envelope if escalated
    evidencePackage?: EvidencePackage; // [AUDITOR-GRADE] JSON schema mapping for MiCA/NIST
    x402PaymentHeader?: string;     // [PAYMENT] Bound payment header for the execution
    enclaveDid: string;             // [AUDIT-GRADE] Hardware identity of the signing enclave
    zkSeal?: {                      // [PHASE 2.1] RISC Zero Mathematical Proof
        journal: any;
        seal: string;               // Base64 encoded ZK-Proof bytes
    };
    timestamp: ISO8601;
    signature: string;              // TEE Hardware Signature (Ed25519)
    batchProof?: {                  // [POST-QUANTUM] Merkle-Rooted Batch Finality
        batchId: string;
        merkleRoot: string;
        pqSignature: string;        // ML-DSA-65 signature of the merkleRoot
        proofPath: string[];        // Merkle proof for this specific receipt
    };
}

/**
 * The unified byte-array representation that strictly binds the Ed25519 
 * execution signature with the ML-DSA-65 audit signature.
 */
export interface AegisCanonicalMessage {
    tenantId: string;
    nonce: string;
    receiptId: string;
    article12LogHash: string;
    timestamp: ISO8601;
}

export interface ProofOfExecution {
    actionId: string;               // UUID v7 (time-ordered)
    agentDid: string;               // Agent identity
    signerType: 'enforcer' | 'agent' | 'dual'; // Aegis TEE = enforcer
    signatureAlgorithm: 'Ed25519' | 'ECDSA-P256' | 'ML-DSA-65';
    action: {
        type: string;
        target: string;
        parameters: Record<string, unknown>;
        resultHash: string;
    };
    context: {
        sessionId: string;
        sequenceNumber: number;
        previousProofHash: string;
        triggeredBy: string;
    };
    decisionProvenance?: {
        pdpDecisionId: string;
        policyBundleHash: string;
        obligationsApplied: string[];
    };
    timestamp: {
        agentClock: ISO8601;
        verifiedSource?: 'rfc3161' | 'ntp-attested' | 'anchor-derived';
    };
    signature: string;              // Enclave Signature
    keyId: string;
    receiptHash?: string;
}

export interface PolicyEvaluationRequest {
    agent: {
        did: string;
        purpose: AgentPurpose;
        currentTier: TrustTier;
    };
    action: {
        actionId?: string;
        toolId: string;
        actionType: string;
        parameters: Record<string, unknown>;
        estimatedValue?: bigint | number;
    };
    context: {
        sessionId: string;
        actionsThisSession: number;
        actionsThisHour: number;
        currentAnomalyScore: number;
        recentIncidents: number;
        currentSlot?: number; // Added for Solana HOTL slot bounds
    };
    agentContext?: {
        prompt: string;
        modelVersion: string;
        jurisdiction: string;
    };
    dynamicPolicy?: {
        policyConfig: {
            policyId: string;
            tenantId: string;
            version?: string;
            chainId?: number;
            crossChainTarget?: string; // VULNERABILITY FIXED: Locks the signature to specific network execution semantics
            maxAnomalyScore: number;
            financialLimitsString: string; // VULNERABILITY FIXED: Hardened cryptographic string binding for mutable parameters
            expiresAt: number; // Unix timestamp for Replay Attack Prevention
            nonce: string; // Cryptographic nonce
            vaultPda?: string; // Target PDA for HOTL Vault
            squadsMultisig?: string; // Target Multisig Address
            allowedProgramIds?: string[]; // Allowed CPI programs
        };
        ownerPublicKey: string; // The hex address that signed the policy
        signature: string; // EIP-712 Signature
    };
}
// Trigger CI
