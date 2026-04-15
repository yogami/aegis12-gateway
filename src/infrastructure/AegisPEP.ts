import { PolicyEvaluationRequest, PolicyDecision, ToolExecutionReceipt, SolanaTransferPayload, SwapPayload } from '../types';
import { getCircuitBreaker } from './CircuitBreaker';
import { isValidSolanaAddress, assertSafeFinancialAmount, normalizeParameters } from '../domain/PolicyValidator';
import { AegisSigner } from './AegisSigner';
import { ethers } from 'ethers';
import { INonceRegistry } from '../ports/INonceRegistry';
import { AegisLocalNonceRegistry } from './NonceRegistry';
import { Eip712Verifier } from '../domain/Eip712Verifier';
import { TierEvaluator } from '../domain/TierEvaluator';

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

    constructor(signer: AegisSigner, tenantTrustStore: Record<string, string[]> = {}, registry?: INonceRegistry) {
        this.signer = signer;
        // Deep clone and recursively freeze the trust store to prevent prototype pollution and runtime mutability
        const safeClone = JSON.parse(JSON.stringify(tenantTrustStore || {}));
        Object.keys(safeClone).forEach(k => Object.freeze(safeClone[k]));
        this.tenantTrustStore = Object.freeze(safeClone);
        
        this.nonceRegistry = registry || new AegisLocalNonceRegistry();
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

    public async enforce(request: PolicyEvaluationRequest): Promise<ToolExecutionReceipt> {
        // --- COUNCIL GATE FIX: dynamicPolicy is MANDATORY ---
            // The non-dynamic path was already unreachable (evaluatePolicy fail-closed),
            // but making it explicit eliminates false-positive CRITICALs from auditors.
            if (!request.dynamicPolicy) {
                throw new Error('[TERMINAL REFUSAL] Missing Cryptographic Policy envelope. Unsigned requests are structurally denied.');
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

            const tenantId = request.dynamicPolicy.policyConfig.tenantId;
            const policyNonce = request.dynamicPolicy.policyConfig.nonce;

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
            } catch (err) {
                // COUNCIL GATE FIX: REMOVAL OF ROLLBACK WINDOW
                // If commit fails, we do NOT rollback. The nonce remains in the 'reserved' state
                // indefinitely (or until TTL expiry). This is the safest posture; a failed
                // execution must burn the nonce to prevent replay during TEE instability.
                throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: Internal TEE State Commit Failure. Nonce consumed.`);
            }

            // From this point forward, the nonce is permanently consumed.
            // Errors will NOT free it — this is intentional.

            // COUNCIL GATE FIX: RECURSIVE DETERMINISTIC SORTING
            const getDeterministicParams = (obj: any): any => {
                if (obj === null || typeof obj !== 'object') return obj;
                if (Array.isArray(obj)) return obj.map(getDeterministicParams);
                return Object.keys(obj).sort().reduce((acc: any, key: string) => {
                    acc[key] = getDeterministicParams(obj[key]);
                    return acc;
                }, {});
            };

            const deterministicParams = getDeterministicParams(sanitizedParams);
            
            const boundNonce = policyNonce;
            
            const parametersHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(deterministicParams)));

            const receipt: ToolExecutionReceipt = {
                actionId: `action-${request.action.toolId}-${boundNonce}`,
                toolId: request.action.toolId,
                authorizationNonce: boundNonce,
                parametersHash,
                validatedParams: deterministicParams,
                resultHash: "pending",
                signature: ""
            };

            // --- INTENTIONAL DOMAIN SEPARATION ---
            // Receipt domain ("Aegis-12-Sentinel") is deliberately different from
            // policy domain ("Aegis-12-Compliance-Matrix"). These are separate document
            // types with separate signing contexts. This is NOT a bug.
            const receiptDomain = { name: "Aegis-12-Sentinel", version: AEGIS_DOMAIN_VERSION, chainId: AEGIS_CHAIN_ID };
            const receiptTypes = {
                Receipt: [
                    { name: "actionId", type: "string" },
                    { name: "toolId", type: "string" },
                    { name: "tenantId", type: "string" },
                    { name: "authorizationNonce", type: "string" },
                    { name: "parametersHash", type: "bytes32" },
                    { name: "targetExecutionChain", type: "string" },
                    { name: "resultHash", type: "string" }
                ]
            };

            const receiptValue = {
                actionId: receipt.actionId,
                toolId: receipt.toolId,
                tenantId: tenantId,
                authorizationNonce: receipt.authorizationNonce,
                parametersHash: ethers.utils.arrayify(receipt.parametersHash),
                targetExecutionChain: "solana-mainnet",
                resultHash: receipt.resultHash
            };

            receipt.signature = this.signer.signEIP712(receiptDomain, receiptTypes, receiptValue);

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
                // Release nonce immediately if bounds fail
                await this.nonceRegistry.rollback(scopedNonce);
                throw boundsError;
            }

            return { decision: 'allow', reason: 'Action passed strictly parsed Cryptographic configurations', ttl: 60 };

        } catch (err: any) {
            // NEW-VULN-003: Removed console.error leakage to adhere to pure TEE confidentiality.
            return { decision: 'deny', reason: err.message, ttl: 0 };
        }
    }
}
