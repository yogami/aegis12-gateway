import { PolicyEvaluationRequest, PolicyDecision, ToolExecutionReceipt } from '../types';
import { getCircuitBreaker } from './CircuitBreaker';
import { AegisSigner } from './AegisSigner';
import { ethers } from 'ethers';

export class AegisPEP {
    private signer: AegisSigner;
    private breaker = getCircuitBreaker('Aegis-PEP-Gateway', { failureThreshold: 3, recoveryTimeMs: 60000 });

    constructor(signer: AegisSigner) {
        this.signer = signer;
    }

    /**
     * The Core Evaluation Loop of the TEE Enclave.
     * Evaluates the action and returns a cryptographically signed receipt or physically refuses.
     */
    public async enforce(request: PolicyEvaluationRequest): Promise<ToolExecutionReceipt> {
        return this.breaker.execute(async () => {
            const decision = this.evaluatePolicy(request);

            if (decision.decision !== 'allow') {
                throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: ${decision.reason}`);
            }

            // If allowed, generate a hardware-signed receipt
            const timestamp = new Date().toISOString();

            // Reconstruct canonical parameters to hash (simplified for MVP)
            const canonicalString = JSON.stringify({
                actionId: request.action.toolId,
                params: request.action.parameters,
                timestamp
            });

            const receipt: ToolExecutionReceipt = {
                actionId: `action-${Date.now()}`,
                toolId: request.action.toolId,
                authorizationNonce: `nonce-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
                parameters: request.action.parameters,
                resultHash: "pending",
                timestamp,
                signature: this.signer.sign(canonicalString)
            };

            return receipt;
        });
    }

    /**
     * Statically embedded Hardcoded Risk Parameters for the MVP DAO.
     * UPDATE: Extracted to Dynamic Cryptographically Signed Policy Injection
     */
    private evaluatePolicy(request: PolicyEvaluationRequest): PolicyDecision {
        const { action, agent, context, dynamicPolicy } = request;

        console.log(`[Aegis TEE] Evaluating action ${action.toolId} for ${agent.did}`);

        // 1. Enforce Cryptographic Policy Loading (Hackathon-Defensible Architecture)
        if (dynamicPolicy) {
            try {
                // The TEE securely extracts the signature identity from the raw payload
                const recoveredAddress = ethers.utils.verifyMessage(
                    dynamicPolicy.signedJsonPayload, 
                    dynamicPolicy.signature
                );

                if (recoveredAddress.toLowerCase() !== dynamicPolicy.ownerPublicKey.toLowerCase()) {
                    return { decision: 'deny', reason: 'Cryptographic Failure: Policy Signature was FORGED or TAMPERED with in transit.', ttl: 0 };
                }

                console.log(`[Aegis TEE] 🔒 Validated Secure Policy Config from Owner: ${recoveredAddress}`);
                
                // Parse the verified JSON payload into memory
                const activePolicy = JSON.parse(dynamicPolicy.signedJsonPayload);

                // Dynamically enforce the verified rulesets
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

        // 2. Fallback execution if no dynamic policy is provided
        console.log(`[Aegis TEE] ⚠️ No dynamic policy provided. Falling back to stringent hardware defaults.`);
        if (context.currentAnomalyScore > 0.8) {
            return { decision: 'deny', reason: 'Fallback anomaly score exceeds TEE threshold (>0.8)', ttl: 0 };
        }

        if (agent.purpose === 'financial_operations') {
            const maxAllowedValue = agent.currentTier === 'T4' ? 100_000 : 10_000;
            const estimatedValue = action.estimatedValue || 0;
            if (estimatedValue > maxAllowedValue) {
                return { decision: 'deny', reason: `Action value ${estimatedValue} exceeds Fallback Tier limit ${maxAllowedValue}`, ttl: 0 };
            }
        }

        return { decision: 'allow', reason: 'Action passed fallback enclave constraints', ttl: 60 };
    }
}
