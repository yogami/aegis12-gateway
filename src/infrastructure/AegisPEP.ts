import { PolicyEvaluationRequest, PolicyDecision, ToolExecutionReceipt, SolanaTransferPayload, SwapPayload } from '../types';
import { getCircuitBreaker } from './CircuitBreaker';
import { AegisSigner } from './AegisSigner';
import { ethers } from 'ethers';
import { INonceRegistry, AegisLocalNonceRegistry } from './NonceRegistry';

export class AegisPEP {
    private signer: AegisSigner;
    private breaker = getCircuitBreaker('Aegis-PEP-Gateway', { failureThreshold: 50, recoveryTimeMs: 60000 });
    
    // Immutable TEE Root of Trust Provisioning
    private tenantTrustStore: Record<string, string[]>;
    
    // --- VULNERABILITY FIXED: STATE-BACKED ANTI-REPLAY VIA 2PC ---
    private nonceRegistry: INonceRegistry;

    constructor(signer: AegisSigner, tenantTrustStore: Record<string, string[]> = {}) {
        this.signer = signer;
        this.tenantTrustStore = tenantTrustStore;
        this.nonceRegistry = new AegisLocalNonceRegistry();
    }

    /**
     * Deterministically normalize and strip raw LLM output into a strict Schema policy envelope.
     */
    private normalizeParameters(toolId: string, rawParams: any): Record<string, unknown> {
        let validated: any = {};
        if (toolId === "solana_transfer") {
            if (typeof rawParams.to !== "string" || rawParams.to.length === 0) throw new Error("Missing or invalid 'to' field");
            if (typeof rawParams.amount !== "number" || rawParams.amount <= 0) throw new Error("Missing or invalid 'amount' field");
            validated = { to: rawParams.to, amount: rawParams.amount };
        } else if (toolId === "swap") {
            if (typeof rawParams.fromMint !== "string" || typeof rawParams.toMint !== "string") throw new Error("Missing mints");
            if (typeof rawParams.amount !== "number" || typeof rawParams.slippageBps !== "number") throw new Error("Missing amounts");
            validated = { fromMint: rawParams.fromMint, toMint: rawParams.toMint, amount: rawParams.amount, slippageBps: rawParams.slippageBps };
        } else {
            // Unrecognized tools are structurally denied
            throw new Error(`Unrecognized tool execution request: ${toolId}`);
        }
        return validated;
    }

    public async enforce(request: PolicyEvaluationRequest): Promise<ToolExecutionReceipt> {
        return this.breaker.execute(async () => {
            const decision = await this.evaluatePolicy(request);

            if (decision.decision !== 'allow') {
                throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: ${decision.reason}`);
            }

            // --- VULNERABILITY 2 FIXED: STRICT SANITIZATION ---
            // Strip hallucinated keys completely and convert to strict determinism
            let validatedParams;
            try {
                validatedParams = this.normalizeParameters(request.action.toolId, request.action.parameters);
            } catch (err: any) {
                throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: Schema Sanitization Failed: ${err.message}`);
            }

            // Lexicographically sort parameters for guaranteed deterministic hashing
            const sortedKeys = Object.keys(validatedParams).sort();
            const deterministicParams: Record<string, unknown> = {};
            for (const k of sortedKeys) {
                deterministicParams[k] = validatedParams[k];
            }
            
            // --- VULNERABILITY FIXED: ERADICATE THE DETERMINISM FRAUD ---
            // Remove ephemeral Math.random() and Date.now() from canonical signing digest
            const boundNonce = request.dynamicPolicy ? request.dynamicPolicy.policyConfig.nonce : "fallback-nonce";
            
            const parametersHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(deterministicParams)));

            const receipt: ToolExecutionReceipt = {
                actionId: `action-${request.action.toolId}-${boundNonce}`,
                toolId: request.action.toolId,
                authorizationNonce: boundNonce,
                parametersHash,
                validatedParams: deterministicParams,
                resultHash: "pending",
                timestamp: new Date().toISOString(), // Optional metadata, NOT cryptographically hashed into the digest boundary
                signature: ""
            };

            // --- ROUND 5 RED-TEAM FIX: EXECUTION DAYLIGHT CLOSURE ---
            // The previous architecture merely hashed internal values, allowing MEV substitution.
            // By constructing an explicit EIP-712 struct payload, the Smart Contract can definitively bind the Receipt.
            const receiptDomain = { name: "Aegis-12-Sentinel", version: "1.0.0", chainId: 1 };
            const receiptTypes = {
                Receipt: [
                    { name: "actionId", type: "string" },
                    { name: "toolId", type: "string" },
                    { name: "authorizationNonce", type: "string" },
                    { name: "parametersHash", type: "string" },
                    { name: "resultHash", type: "string" }
                ]
            };

            const receiptValue = {
                actionId: receipt.actionId,
                toolId: receipt.toolId,
                authorizationNonce: receipt.authorizationNonce,
                parametersHash: receipt.parametersHash,
                resultHash: receipt.resultHash
            };

            receipt.signature = this.signer.signEIP712(receiptDomain, receiptTypes, receiptValue);

            // --- ROUND 5: COMMIT THE 2PC TO PREVENT REPLAYS AFTER SUCCESS ---
            if (request.dynamicPolicy) {
                await this.nonceRegistry.commit(boundNonce);
            }

            return receipt;
        });
    }

    private async evaluatePolicy(request: PolicyEvaluationRequest): Promise<PolicyDecision> {
        const { action, agent, context, dynamicPolicy } = request;

        if (dynamicPolicy) {
            try {
                const domain = {
                    name: "Aegis-12-Compliance-Matrix",
                    version: dynamicPolicy.policyConfig.version || "1.0.0",
                    chainId: dynamicPolicy.policyConfig.chainId || 1, 
                };

                const types = {
                    Policy: [
                        { name: "policyId", type: "string" },
                        { name: "tenantId", type: "string" },
                        // --- VULNERABILITY FIXED: STRICT CRYPTOGRAPHIC BINDINGS ---
                        { name: "version", type: "string" },
                        { name: "chainId", type: "uint256" },
                        { name: "maxAnomalyScore", type: "uint256" },
                        { name: "financialLimitsString", type: "string" },
                        { name: "expiresAt", type: "uint256" },
                        { name: "nonce", type: "string" }
                    ]
                };

                const value = {
                    policyId: dynamicPolicy.policyConfig.policyId,
                    tenantId: dynamicPolicy.policyConfig.tenantId,
                    version: dynamicPolicy.policyConfig.version || "1.0.0",
                    chainId: dynamicPolicy.policyConfig.chainId || 1,
                    maxAnomalyScore: dynamicPolicy.policyConfig.maxAnomalyScore,
                    financialLimitsString: dynamicPolicy.policyConfig.financialLimitsString || "{}",
                    expiresAt: dynamicPolicy.policyConfig.expiresAt,
                    nonce: dynamicPolicy.policyConfig.nonce
                };

                const recoveredAddress = ethers.utils.verifyTypedData(domain, types, value, dynamicPolicy.signature);

                // --- VULNERABILITY 1 FIXED: ROOT OF TRUST ASSERTION ---
                // Cross-check recovered address against hardcoded hardware Root-of-Trust Store
                const tenantId = dynamicPolicy.policyConfig.tenantId;
                const authorizedKeys = this.tenantTrustStore[tenantId];
                
                if (!authorizedKeys || !authorizedKeys.some(k => k.toLowerCase() === recoveredAddress.toLowerCase())) {
                    return { decision: 'deny', reason: 'Cryptographic Failure: Signer not found in provisioned TEE Root-of-Trust (Policy Forgery Attempt).', ttl: 0 };
                }

                const currentTime = Math.floor(Date.now() / 1000);
                if (currentTime > dynamicPolicy.policyConfig.expiresAt) {
                    return { decision: 'deny', reason: '[TERMINAL REFUSAL] Policy Expired (Replay Attack Detected). Valid time window has closed.', ttl: 0 };
                }

                // --- ROUND 5 RED-TEAM FIX: TOCTOU 2PC MUTEX ---
                // We abstract the `usedNonces` physics into an async Registry that locks the nonce dynamically.
                // It stays Pending internally. If the limits below fail, it throws and unlocks. 
                // If it passes, it is formally committed in `enforce`.
                const reserved = await this.nonceRegistry.reserve(dynamicPolicy.policyConfig.nonce);
                if (!reserved) {
                    return { decision: 'deny', reason: '[TERMINAL REFUSAL] Nonce already used (Double-Spend Replay Attack Detected).', ttl: 0 };
                }
                
                const activePolicy = dynamicPolicy.policyConfig;

                if (activePolicy.maxAnomalyScore && context.currentAnomalyScore > activePolicy.maxAnomalyScore) {
                    await this.nonceRegistry.rollback(dynamicPolicy.policyConfig.nonce);
                    return { decision: 'deny', reason: `Anomaly score exceeds Dynamic TEE threshold (>${activePolicy.maxAnomalyScore})`, ttl: 0 };
                }

                // --- ROUND 4 RED-TEAM FIX: THE SIGNATURE PARAMETER BISECTION ATTACK ---
                // Never extract financial limits from the mutable unverified JSON layer.
                const verifiedLimits = JSON.parse(activePolicy.financialLimitsString || "{}");

                if (agent.purpose === 'financial_operations' && Object.keys(verifiedLimits).length > 0) {
                    const maxAllowedValue = verifiedLimits[agent.currentTier] || 0;
                    const estimatedValue = action.estimatedValue || 0;

                    if (estimatedValue > maxAllowedValue) {
                        await this.nonceRegistry.rollback(dynamicPolicy.policyConfig.nonce);
                        return { decision: 'deny', reason: `Action value ${estimatedValue} exceeds mathematically signed Tier limit ${maxAllowedValue}`, ttl: 0 };
                    }
                }

                return { decision: 'allow', reason: 'Action passed strictly parsed Cryptographic configurations', ttl: 60 };

            } catch (err) {
                // Failsafe unlock: if anything throws inside evaluate, release the lock.
                if (request.dynamicPolicy) {
                    await this.nonceRegistry.rollback(request.dynamicPolicy.policyConfig.nonce);
                }
                return { decision: 'deny', reason: 'Cryptographic Payload processing failed.', ttl: 0 };
            }
        }
        // --- VULNERABILITY FIXED: THE FATAL FALLBACK LOOPHOLE ---
        return { decision: 'deny', reason: '[TERMINAL REFUSAL] Missing Cryptographic Policy. Zero-Trust Gateway defaults to Fail-Closed.', ttl: 0 };
    }
}
