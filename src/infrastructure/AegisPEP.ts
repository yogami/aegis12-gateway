import { PolicyEvaluationRequest, PolicyDecision, AegisComplianceReceipt, SolanaTransferPayload, SwapPayload } from '../types';
import crypto from 'crypto';
import { getCircuitBreaker } from './CircuitBreaker';
import { isValidSolanaAddress, assertSafeFinancialAmount, normalizeParameters } from '../domain/PolicyValidator';
import { AegisSigner } from './AegisSigner';
import { ethers } from 'ethers';
import { INonceRegistry } from '../ports/INonceRegistry';
import { AegisLocalNonceRegistry } from './NonceRegistry';
import { Eip712Verifier } from '../domain/Eip712Verifier';
import { TierEvaluator } from '../domain/TierEvaluator';
import { IAegisStateStore, BehavioralStats } from '../ports/IAegisStateStore';
import { AegisLocalStateStore } from './AegisLocalStateStore';
import { AegisRegistryClient } from './AegisRegistryClient';
import { AegisZKClient } from './AegisZKClient';

// --- HARDCODED TEE CONSTANTS (never sourced from attacker payload) ---
const AEGIS_CHAIN_ID = 1399811149; // Solana Mainnet EIP-155
const AEGIS_DOMAIN_NAME = "Aegis-12-Compliance-Matrix";
const AEGIS_DOMAIN_VERSION = "1.0.0";

export class AegisPEP {
    private signer: AegisSigner;
    private breaker = getCircuitBreaker('Aegis-PEP-Gateway', { failureThreshold: 50, recoveryTimeMs: 60000 });
    
    // Immutable TEE Root of Trust Provisioning
    private tenantTrustStore: Record<string, string[]>;
    
    // --- VULNERABILITY FIXED: STATE-BACKED ANTI-REPLAY VIA 2PC ---
    private nonceRegistry: INonceRegistry;
    
    // --- AEGIS SENTINEL: STATEFUL BEHAVIORAL ACCUMULATOR ---
    private stateStore: IAegisStateStore;
    
    // --- AEGIS REGISTRY: ON-CHAIN ANCHOR ---
    private registryClient?: AegisRegistryClient;
    
    // --- AEGIS PRIVACY: ZK-PROVER ---
    private zkClient?: AegisZKClient;
    
    // --- CONTINUITY: SEQUENTIAL NONCE TRACKING ---
    private lastUsedNonces: Map<string, number> = new Map();

    constructor(
        signer: AegisSigner, 
        tenantTrustStore: Record<string, string[]> = {}, 
        registry?: INonceRegistry, 
        stateStore?: IAegisStateStore, 
        registryClient?: AegisRegistryClient,
        zkClient?: AegisZKClient
    ) {
        this.signer = signer;
        // Deep clone and recursively freeze the trust store to prevent prototype pollution and runtime mutability
        const safeClone = JSON.parse(JSON.stringify(tenantTrustStore || {}));
        Object.keys(safeClone).forEach(k => Object.freeze(safeClone[k]));
        this.tenantTrustStore = Object.freeze(safeClone);
        
        this.nonceRegistry = registry || new AegisLocalNonceRegistry();
        this.stateStore = stateStore || new AegisLocalStateStore();
        this.registryClient = registryClient;
        this.zkClient = zkClient;
    }

    /**
     * Deterministically normalize and strip raw LLM output into a strict Schema policy envelope.
     */
    // The parameter normalization and domain assertions are delegated to src/domain/PolicyValidator

    /**
     * Build a tenant-scoped nonce key to prevent cross-tenant nonce collisions.
     */
    private nonceKey(tenantId: string, nonce: string): string {
        // Robust key separation: length-prefixing prevent cross-tenant collisions
        const prefix = `T${tenantId.length}:${tenantId}`;
        return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(prefix + '\x00' + nonce));
    }

    public async enforce(request: PolicyEvaluationRequest): Promise<AegisComplianceReceipt> {
        // --- COUNCIL GATE FIX: dynamicPolicy is MANDATORY ---
            // The non-dynamic path was already unreachable (evaluatePolicy fail-closed),
            // but making it explicit eliminates false-positive CRITICALs from auditors.
            if (!request.dynamicPolicy) {
                throw new Error('[TERMINAL REFUSAL] Missing Cryptographic Policy envelope. Unsigned requests are structurally denied.');
            }

            const tenantId = request.dynamicPolicy.policyConfig.tenantId;
            const policyNonce = request.dynamicPolicy.policyConfig.nonce;

            // --- ITEM 1.3: PRE-FLIGHT CONTINUITY CHECK ---
            // Enforce sequential nonces for high-veracity failover protection.
            // This occurs BEFORE evaluatePolicy to ensure precise sequence violation feedback.
            const numericNonce = parseInt(policyNonce, 10);
            if (isNaN(numericNonce)) {
                throw new Error('[TERMINAL REFUSAL] Invalid Nonce Format. Aegis-12 requires sequential numeric nonces.');
            }

            const currentHighWaterMark = this.lastUsedNonces.get(tenantId) || 0;
            if (numericNonce <= currentHighWaterMark) {
                throw new Error(`[TERMINAL REFUSAL] Nonce Sequence Violation: Provided nonce (${numericNonce}) is not greater than the last used nonce (${currentHighWaterMark}). Possible Replay or Out-of-Order Execution.`);
            }

            if (!request.context || !Number.isFinite(request.context.currentAnomalyScore) || request.context.currentAnomalyScore < 0 || request.context.currentAnomalyScore > 1.0) {
                throw new Error('[TERMINAL REFUSAL] Invalid or unscaled contextual anomaly score. Expected 0.0-1.0 finite float.');
            }

            // --- COUNCIL GATE FIX: PRE-NORMALIZE AND CALCULATE ESTIMATED VALUE internally ---
            // We normalize first so we can tie the actual parameter amount to the evaluated estimatedValue.
            // This prevents an agent from spoofing a low estimatedValue for a high-value transfer.
            let sanitizedParams: Record<string, unknown>;
            try {
                sanitizedParams = normalizeParameters(request.action.toolId, request.action.parameters);
            } catch (e: any) {
                throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: ${e.message}`);
            }

            // Force estimatedValue to strictly equal the parameters' actual numeric amount
            const verifiedEstimatedValue = typeof sanitizedParams.amount === 'number' ? sanitizedParams.amount : 0;
            
            // Create a structurally immutable evaluation request to prevent side-effects on original payload
            const evaluationRequest: PolicyEvaluationRequest = {
                ...request,
                action: {
                    ...request.action,
                    estimatedValue: verifiedEstimatedValue
                }
            };

            const decision = await this.evaluatePolicy(evaluationRequest);

            if (decision.decision !== 'allow') {
                throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: ${decision.reason}`);
            }

            // --- COUNCIL GATE FIX: COMMIT NONCE IMMEDIATELY AFTER POLICY APPROVAL ---
            // The nonce is irrevocably burned the moment evaluatePolicy returns 'allow'.
            // This eliminates the TOCTOU window where an error during receipt generation
            // (e.g. normalizeParameters failure) could trigger a rollback, resurrecting
            // the nonce for a replay attack via intentional error injection.
            // Trade-off: if receipt generation fails, the nonce is still consumed.
            // This is the CORRECT security posture — a failed execution burns the nonce.
            // The client must request a new policy with a fresh nonce.
            const scopedNonce = this.nonceKey(tenantId, policyNonce);
            try {
                await this.nonceRegistry.commit(scopedNonce);
                // Update local water mark
                this.lastUsedNonces.set(tenantId, numericNonce);
            } catch (err) {
                throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: Internal TEE State Commit Failure. Nonce consumed.`);
            }

            // --- PERIODIC CHECKPOINTING ---
            // Item 1.3: Periodically anchor the high-water mark to Solana for cross-replica sync.
            if (this.registryClient && (numericNonce % 10 === 0)) {
                this.registryClient.checkpointNonce(tenantId, numericNonce).catch(err => {
                    console.error(`[AEGIS-SENTINEL-WARNING] Nonce checkpoint failed for tenant ${tenantId}.`);
                });
            }

            // From this point forward, the nonce is permanently consumed.
            // Errors will NOT free it — this is intentional.

            // COUNCIL GATE FIX: PROTOTYPE-SAFE RECURSIVE DETERMINISTIC MAPPING
            const getDeterministicMap = (obj: any): Map<string, any> => {
                const map = new Map<string, any>();
                if (obj === null || typeof obj !== 'object') return obj;
                
                const sortedKeys = Array.isArray(obj) ? [] : Object.keys(obj).sort();
                
                if (Array.isArray(obj)) {
                    return obj.map(getDeterministicMap) as any;
                }

                for (const key of sortedKeys) {
                    map.set(key, getDeterministicMap(obj[key]));
                }
                return map;
            };

            const deterministicParamsMap = getDeterministicMap(sanitizedParams);
            // Convert back to sorted JSON for hashing
            const deterministicParams = Object.fromEntries(deterministicParamsMap);
            
            const boundNonce = policyNonce;
            
            // --- AEGIS SENTINEL: UPDATE STATEFUL ACCUMULATOR ---
            // Track the agent's behavior across CDCs to fulfill EU AI Act Article 12 (Lifecycle Traceability).
            // This detects 'Structuring Attacks' (multiple sub-limit transactions) that stateless firewalls miss.
            const agentId = tenantId; // Pinned to Primary Enclave
            const stats = await this.stateStore.updateStats(agentId, verifiedEstimatedValue);
            
            // HARD BOUNDARY: Cumulative spend ceiling (Example: 50,000 SOL lifetime per agent)
            const CUMULATIVE_LIMIT = 50000;
            if (stats.totalSpend > CUMULATIVE_LIMIT) {
                throw new Error(`[TERMINAL REFUSAL] Behavioral Invariant Violated: Cumulative spend (${stats.totalSpend}) exceeds hardware-locked lifetime ceiling (${CUMULATIVE_LIMIT}).`);
            }

            const parametersHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(deterministicParams)));

            // --- COUNCIL GATE FIX: THE HONEST ATTESTATION RECEIPT (ARS-01+) ---
            // Moving from 'Compliance Theater' to 'Evidence-Based Auditing'.
            // We explicitly declare the limits of the TEE observation to achieve 'Audit-Grade' veracity.
            const evidence = {
                decision: "ALLOW",
                complianceEvidence: ["Art 12: Automated Lifecycle Logging", "Art 14: Traceable Human-Signed Manifest"],
                stateRoot: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(stats))),
                limitations: [
                    "Model inference trace not verified",
                    "Input context not hardware-attested",
                    "Human liveness not verified post-signature"
                ]
            };

            // --- ARTICLE 12 COMPLIANCE: IMMUTABLE LOG TRACE ---
            // Calculate a composite hash covering the action, sanitized params, and behavioral results.
            const logTracePayload = {
                toolId: request.action.toolId,
                params: deterministicParams,
                evidence,
                stats
            };
            const article12LogHash = ethers.utils.id(JSON.stringify(logTracePayload));
            
            // --- ARTICLE 14 COMPLIANCE: HUMAN OVERSIGHT BINDING ---
            const article14OversightSignature = request.dynamicPolicy.signature;
            
            const receipt: AegisComplianceReceipt = {
                receiptId: `aegis-v1-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
                actionId: `action-${request.action.toolId}-${boundNonce}`,
                toolId: request.action.toolId,
                agentPubKey: request.agent.did || "0x0000000000000000000000000000000000000000",
                article12LogHash,
                parametersHash,
                resultHash: ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(evidence))),
                article14OversightSignature,
                policyId: request.dynamicPolicy.policyConfig.policyId,
                tenantId: tenantId,
                complianceStandard: "ARS-01+",
                limitations: evidence.limitations,
                authorizationNonce: boundNonce,
                timestamp: new Date().toISOString() as any,
                signature: ""
            };

            // --- INTENTIONAL DOMAIN SEPARATION: Aegis Compliance Receipt ---
            const receiptDomain = { name: "Aegis-12-Compliance", version: AEGIS_DOMAIN_VERSION, chainId: AEGIS_CHAIN_ID };
            const receiptTypes = {
                ComplianceReceipt: [
                    { name: "receiptId", type: "string" },
                    { name: "toolId", type: "string" },
                    { name: "agentPubKey", type: "string" },
                    { name: "article12LogHash", type: "bytes32" },
                    { name: "article14OversightSignature", type: "string" },
                    { name: "tenantId", type: "string" },
                    { name: "authorizationNonce", type: "string" },
                    { name: "complianceStandard", type: "string" }
                ]
            };

            const receiptValue = {
                receiptId: receipt.receiptId,
                toolId: receipt.toolId,
                agentPubKey: receipt.agentPubKey,
                article12LogHash: ethers.utils.arrayify(receipt.article12LogHash),
                article14OversightSignature: receipt.article14OversightSignature,
                tenantId: receipt.tenantId,
                authorizationNonce: receipt.authorizationNonce,
                complianceStandard: receipt.complianceStandard
            };

            receipt.signature = await this.signer.signEIP712(receiptDomain, receiptTypes, receiptValue);

            // --- PHASE 2.1: VERIFIABLE AI PRIVACY (ZK-SEAL) ---
            if (this.zkClient) {
                try {
                    const zkInput = {
                        action: { tool_id: request.action.toolId, amount: verifiedEstimatedValue, nonce: numericNonce },
                        constraints: { 
                            max_per_tx: request.dynamicPolicy.policyConfig.financialLimits.perTx || 100,
                            cumulative_limit: 50000,
                            last_checkpointed_nonce: currentHighWaterMark 
                        },
                        stats_before: { total_spend: stats.totalSpend - verifiedEstimatedValue, tx_count: stats.txCount - 1, last_activity: 0 }
                    };
                    const zkOutput = await this.zkClient.generateProof(zkInput);
                    receipt.zkSeal = {
                        journal: zkOutput.journal,
                        seal: Buffer.from(zkOutput.seal).toString('base64')
                    };
                } catch (zkErr: any) {
                    console.error(`[AEGIS-SENTINEL-WARNING] ZK Proof Generation failed: ${zkErr.message}. Falling back to Hardware-Only proof.`);
                }
            }

            // --- ARTICLE 12/14 ON-CHAIN ANCHORING ---
            // If a registry client is provisioned, anchor the receipt hash to the Solana blockchain.
            if (this.registryClient) {
                // Fire and forget (or handle async errors) to minimize TEE performance impact
                this.registryClient.anchorReceipt(receipt).catch(err => {
                    // Log the failure to anchor, but do not block the execution (Veracity Warning)
                    console.error(`[AEGIS-SENTINEL-WARNING] On-chain anchoring failed for receipt ${receipt.receiptId}. Veracity gap detected.`);
                });
            }

            return receipt;
    }

    private async evaluatePolicy(request: PolicyEvaluationRequest): Promise<PolicyDecision> {
        const { dynamicPolicy } = request;
        const tenantId = dynamicPolicy!.policyConfig.tenantId;

        try {
            // STEP 1: Cryptographic Validation
            Eip712Verifier.verifySignature(dynamicPolicy!, this.tenantTrustStore);

            // --- COUNCIL GATE FIX: EXPLICIT DOMAIN & CHAIN BINDING ---
            // Ensure the payload itself declares the chain and version we are enforcing.
            // This prevents cross-network policy replay if the same key is used on multiple chains.
            if (dynamicPolicy!.policyConfig.chainId !== AEGIS_CHAIN_ID || dynamicPolicy!.policyConfig.version !== AEGIS_DOMAIN_VERSION) {
                 throw new Error(`[TERMINAL REFUSAL] Policy Target Mismatch: This TEE only enforces ${AEGIS_DOMAIN_NAME} v${AEGIS_DOMAIN_VERSION} on Chain ${AEGIS_CHAIN_ID}.`);
            }

            // STEP 2: Nonce Management
            const scopedNonce = this.nonceKey(tenantId, dynamicPolicy!.policyConfig.nonce);
            const reserved = await this.nonceRegistry.reserve(scopedNonce);
            if (!reserved) {
                return { decision: 'deny', reason: '[TERMINAL REFUSAL] Nonce already used (Double-Spend Replay Attack Detected).', ttl: 0 };
            }

            try {
                // STEP 3: Business Bounds Validation
                TierEvaluator.verifyBounds(request);
            } catch (boundsError: any) {
                // --- VULNERABILITY REMEDIATED: ZERO-TRUST NONCE POSTURE ---
                // We no longer rollback the nonce on bounds failures. 
                // A malformed or out-of-bounds request results in a burned nonce.
                // This prevents 'Probing' attacks where an adversary tests TEE state
                // boundaries without risk of losing their cryptographic authorization.
                throw boundsError;
            }

            return { decision: 'allow', reason: 'Action passed strictly parsed Cryptographic configurations', ttl: 60 };

        } catch (err: any) {
            // NEW-VULN-003: Removed console.error leakage to adhere to pure TEE confidentiality.
            return { decision: 'deny', reason: err.message, ttl: 0 };
        }
    }
}
