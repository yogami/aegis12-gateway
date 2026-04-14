import { PolicyEvaluationRequest, PolicyDecision, ToolExecutionReceipt, SolanaTransferPayload, SwapPayload } from '../types';
import { getCircuitBreaker } from './CircuitBreaker';
import { AegisSigner } from './AegisSigner';
import { ethers } from 'ethers';

export class AegisPEP {
    private signer: AegisSigner;
    private breaker = getCircuitBreaker('Aegis-PEP-Gateway', { failureThreshold: 50, recoveryTimeMs: 60000 });
    
    // Immutable TEE Root of Trust Provisioning
    private tenantTrustStore: Record<string, string[]>;

    constructor(signer: AegisSigner, tenantTrustStore: Record<string, string[]> = {}) {
        this.signer = signer;
        this.tenantTrustStore = tenantTrustStore;
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
            const decision = this.evaluatePolicy(request);

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
            
            const timestamp = new Date().toISOString();
            const parametersHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(deterministicParams)));

            const canonicalString = JSON.stringify({
                actionId: request.action.toolId,
                parametersHash,
                timestamp
            });

            const receipt: ToolExecutionReceipt = {
                actionId: `action-${Date.now()}`,
                toolId: request.action.toolId,
                authorizationNonce: `nonce-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
                parametersHash,
                validatedParams: deterministicParams,
                resultHash: "pending",
                timestamp,
                signature: this.signer.sign(canonicalString)
            };

            return receipt;
        });
    }

    private evaluatePolicy(request: PolicyEvaluationRequest): PolicyDecision {
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
                        { name: "maxAnomalyScore", type: "uint256" },
                        { name: "expiresAt", type: "uint256" },
                        { name: "nonce", type: "string" }
                    ]
                };

                const value = {
                    policyId: dynamicPolicy.policyConfig.policyId,
                    tenantId: dynamicPolicy.policyConfig.tenantId,
                    maxAnomalyScore: dynamicPolicy.policyConfig.maxAnomalyScore,
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
                
                const activePolicy = dynamicPolicy.policyConfig;

                if (activePolicy.maxAnomalyScore && context.currentAnomalyScore > activePolicy.maxAnomalyScore) {
                    return { decision: 'deny', reason: `Anomaly score exceeds Dynamic TEE threshold (>${activePolicy.maxAnomalyScore})`, ttl: 0 };
                }

                if (agent.purpose === 'financial_operations' && activePolicy.financialLimits) {
                    const maxAllowedValue = activePolicy.financialLimits[agent.currentTier] || 0;
                    const estimatedValue = action.estimatedValue || 0;

                    if (estimatedValue > maxAllowedValue) {
                        return { decision: 'deny', reason: `Action value ${estimatedValue} exceeds Dynamic Tier limit ${maxAllowedValue}`, ttl: 0 };
                    }
                }

                return { decision: 'allow', reason: 'Action passed Cryptographically Injected configurations', ttl: 60 };

            } catch (err) {
                return { decision: 'deny', reason: 'Cryptographic Payload processing failed.', ttl: 0 };
            }
        }
        
        return { decision: 'allow', reason: 'Fallback executed', ttl: 60 };
    }
}
