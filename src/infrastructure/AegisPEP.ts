import { PolicyEvaluationRequest, PolicyDecision, ToolExecutionReceipt, SolanaTransferPayload, SwapPayload } from '../types';
import { getCircuitBreaker } from './CircuitBreaker';
import { AegisSigner } from './AegisSigner';
import { ethers } from 'ethers';
import { INonceRegistry, AegisLocalNonceRegistry } from './NonceRegistry';

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

    constructor(signer: AegisSigner, tenantTrustStore: Record<string, string[]> = {}) {
        this.signer = signer;
        this.tenantTrustStore = tenantTrustStore;
        this.nonceRegistry = new AegisLocalNonceRegistry();
    }

    /**
     * Deterministically normalize and strip raw LLM output into a strict Schema policy envelope.
     */
    /**
     * Validate a number is a safe integer or finite positive value suitable for financial ops.
     * Prevents IEEE 754 float manipulation, NaN injection, and precision loss attacks.
     */
    private assertSafeFinancialAmount(value: unknown, fieldName: string): number {
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
            throw new Error(`Invalid ${fieldName}: must be a finite positive number`);
        }
        if (value > Number.MAX_SAFE_INTEGER) {
            throw new Error(`Invalid ${fieldName}: exceeds MAX_SAFE_INTEGER precision boundary`);
        }
        return value;
    }

    private normalizeParameters(toolId: string, rawParams: any): Record<string, unknown> {
        let validated: any = {};
        if (toolId === "solana_transfer") {
            if (typeof rawParams.to !== "string" || rawParams.to.length === 0) throw new Error("Missing or invalid 'to' field");
            this.assertSafeFinancialAmount(rawParams.amount, "amount");
            if (typeof rawParams.token !== "string" || rawParams.token.length === 0) throw new Error("Missing 'token' field preventing asset substitution");
            validated = { token: rawParams.token, to: rawParams.to, amount: rawParams.amount };
        } else if (toolId === "swap") {
            if (typeof rawParams.fromMint !== "string" || typeof rawParams.toMint !== "string") throw new Error("Missing mints");
            if (rawParams.fromMint === rawParams.toMint) throw new Error("Identical mint swap rejected (self-swap MEV vector)");
            this.assertSafeFinancialAmount(rawParams.amount, "amount");
            if (typeof rawParams.slippageBps !== "number" || rawParams.slippageBps < 0 || rawParams.slippageBps > 5000) {
                throw new Error("slippageBps out of safe bounds (0-5000)");
            }
            validated = { fromMint: rawParams.fromMint, toMint: rawParams.toMint, amount: rawParams.amount, slippageBps: rawParams.slippageBps };
        } else {
            // Unrecognized tools are structurally denied
            throw new Error(`Unrecognized tool execution request: ${toolId}`);
        }
        return validated;
    }

    /**
     * Build a tenant-scoped nonce key to prevent cross-tenant nonce collisions.
     */
    private nonceKey(tenantId: string, nonce: string): string {
        return `${tenantId}:${nonce}`;
    }

    public async enforce(request: PolicyEvaluationRequest): Promise<ToolExecutionReceipt> {
        return this.breaker.execute(async () => {
            const decision = await this.evaluatePolicy(request);

            if (decision.decision !== 'allow') {
                throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: ${decision.reason}`);
            }

            // Track whether rollback was already performed inside evaluatePolicy's catch.
            // This prevents the double-rollback nonce resurrection bug.
            let nonceCommitted = false;

            try {
                let validatedParams;
                try {
                    validatedParams = this.normalizeParameters(request.action.toolId, request.action.parameters);
                } catch (err: any) {
                    throw new Error(`[TERMINAL REFUSAL] Action denied by Aegis Enclave: Schema Sanitization Failed: ${err.message}`);
                }

                const sortedKeys = Object.keys(validatedParams).sort();
                const deterministicParams: Record<string, unknown> = {};
                for (const k of sortedKeys) {
                    deterministicParams[k] = validatedParams[k];
                }
                
                const boundNonce = request.dynamicPolicy ? request.dynamicPolicy.policyConfig.nonce : crypto.randomUUID();
                
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

                const receiptDomain = { name: "Aegis-12-Sentinel", version: AEGIS_DOMAIN_VERSION, chainId: AEGIS_CHAIN_ID };
                const receiptTypes = {
                    Receipt: [
                        { name: "actionId", type: "string" },
                        { name: "toolId", type: "string" },
                        { name: "authorizationNonce", type: "string" },
                        { name: "parametersHash", type: "string" },
                        { name: "targetExecutionChain", type: "string" },
                        { name: "resultHash", type: "string" }
                    ]
                };

                const receiptValue = {
                    actionId: receipt.actionId,
                    toolId: receipt.toolId,
                    authorizationNonce: receipt.authorizationNonce,
                    parametersHash: receipt.parametersHash,
                    targetExecutionChain: "solana-mainnet",
                    resultHash: receipt.resultHash
                };

                receipt.signature = this.signer.signEIP712(receiptDomain, receiptTypes, receiptValue);

                if (request.dynamicPolicy) {
                    const scopedNonce = this.nonceKey(request.dynamicPolicy.policyConfig.tenantId, request.dynamicPolicy.policyConfig.nonce);
                    await this.nonceRegistry.commit(scopedNonce);
                    nonceCommitted = true;
                }

                return receipt;
            } catch (err) {
                // Only rollback if we haven't already committed AND evaluatePolicy didn't already rollback.
                // The evaluatePolicy method handles its own rollback on deny paths.
                // This catch only fires for errors AFTER evaluatePolicy returned 'allow'.
                if (request.dynamicPolicy && !nonceCommitted) {
                    const scopedNonce = this.nonceKey(request.dynamicPolicy.policyConfig.tenantId, request.dynamicPolicy.policyConfig.nonce);
                    await this.nonceRegistry.rollback(scopedNonce);
                }
                throw err;
            }
        });
    }

    private async evaluatePolicy(request: PolicyEvaluationRequest): Promise<PolicyDecision> {
        const { action, agent, context, dynamicPolicy } = request;

        if (dynamicPolicy) {
            // Track if we reserved the nonce so we know if rollback is needed on error
            let nonceReserved = false;
            let scopedNonce = '';

            try {
                // --- COUNCIL FIX: HARDCODED DOMAIN (never from attacker payload) ---
                // The chainId and version are TEE constants, not request fields.
                // An attacker cannot manipulate domain binding.
                const domain = {
                    name: AEGIS_DOMAIN_NAME,
                    version: AEGIS_DOMAIN_VERSION,
                    chainId: AEGIS_CHAIN_ID,
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
                    crossChainTarget: dynamicPolicy.policyConfig.crossChainTarget || "ethereum",
                    maxAnomalyScore: dynamicPolicy.policyConfig.maxAnomalyScore,
                    financialLimitsString: dynamicPolicy.policyConfig.financialLimitsString || "{}",
                    expiresAt: dynamicPolicy.policyConfig.expiresAt,
                    nonce: dynamicPolicy.policyConfig.nonce
                };

                const recoveredAddress = ethers.utils.verifyTypedData(domain, types, value, dynamicPolicy.signature);

                // --- CROSS-CHAIN REPLAY DETONATION ---
                if (value.crossChainTarget !== "solana-mainnet") {
                    return { decision: 'deny', reason: 'Cryptographic Failure: EIP-712 Intent mapped to incorrect blockchain. Cross-Chain Replay Defended.', ttl: 0 };
                }

                // --- ROOT OF TRUST ASSERTION ---
                const tenantId = dynamicPolicy.policyConfig.tenantId;
                const authorizedKeys = this.tenantTrustStore[tenantId];
                
                if (!authorizedKeys || !authorizedKeys.some(k => k.toLowerCase() === recoveredAddress.toLowerCase())) {
                    return { decision: 'deny', reason: 'Cryptographic Failure: Signer not found in provisioned TEE Root-of-Trust (Policy Forgery Attempt).', ttl: 0 };
                }

                const currentTime = Math.floor(Date.now() / 1000);
                if (currentTime > dynamicPolicy.policyConfig.expiresAt) {
                    return { decision: 'deny', reason: '[TERMINAL REFUSAL] Policy Expired (Replay Attack Detected). Valid time window has closed.', ttl: 0 };
                }

                // --- TENANT-SCOPED NONCE RESERVATION ---
                scopedNonce = this.nonceKey(tenantId, dynamicPolicy.policyConfig.nonce);
                const reserved = await this.nonceRegistry.reserve(scopedNonce);
                if (!reserved) {
                    return { decision: 'deny', reason: '[TERMINAL REFUSAL] Nonce already used (Double-Spend Replay Attack Detected).', ttl: 0 };
                }
                nonceReserved = true;
                
                const activePolicy = dynamicPolicy.policyConfig;

                if (activePolicy.maxAnomalyScore && context.currentAnomalyScore > activePolicy.maxAnomalyScore) {
                    await this.nonceRegistry.rollback(scopedNonce);
                    nonceReserved = false;
                    return { decision: 'deny', reason: `Anomaly score exceeds Dynamic TEE threshold (>${activePolicy.maxAnomalyScore})`, ttl: 0 };
                }

                // --- COUNCIL FIX: BOUNDED FINANCIAL LIMITS STRING ---
                const rawLimitsStr = activePolicy.financialLimitsString || "{}";
                if (rawLimitsStr.length > 1024) {
                    throw new Error("financialLimitsString exceeds 1024 byte safety bound (parser bomb defense)");
                }
                const verifiedLimits = JSON.parse(rawLimitsStr);

                if (agent.purpose === 'financial_operations' && Object.keys(verifiedLimits).length > 0) {
                    const maxAllowedValue = verifiedLimits[agent.currentTier];
                    
                    // --- COUNCIL FIX: DENY UNKNOWN TIERS BY DEFAULT ---
                    // If the agent claims a tier not in the signed limits, deny immediately.
                    // This closes the ghost-tier bypass where an attacker uses 'T_GHOST' to skip all limits.
                    if (maxAllowedValue === undefined) {
                        await this.nonceRegistry.rollback(scopedNonce);
                        nonceReserved = false;
                        return { decision: 'deny', reason: `[TERMINAL REFUSAL] Agent tier '${agent.currentTier}' not found in signed financial limits. Default-deny.`, ttl: 0 };
                    }

                    if (typeof maxAllowedValue !== 'number' || !Number.isFinite(maxAllowedValue)) {
                        throw new Error("Financial limit must be a finite strict number");
                    }
                    const estimatedValue = action.estimatedValue;
                    if (typeof estimatedValue !== 'number' || !Number.isFinite(estimatedValue)) {
                        throw new Error("[TERMINAL REFUSAL] estimatedValue missing or invalid type");
                    }
                    if (estimatedValue > maxAllowedValue) {
                        await this.nonceRegistry.rollback(scopedNonce);
                        nonceReserved = false;
                        return { decision: 'deny', reason: `Action value ${estimatedValue} exceeds mathematically signed Tier limit ${maxAllowedValue}`, ttl: 0 };
                    }
                }

                return { decision: 'allow', reason: 'Action passed strictly parsed Cryptographic configurations', ttl: 60 };

            } catch (err) {
                // Failsafe rollback ONLY if we actually reserved and haven't already rolled back.
                if (nonceReserved) {
                    await this.nonceRegistry.rollback(scopedNonce);
                }
                return { decision: 'deny', reason: 'Cryptographic Payload processing failed.', ttl: 0 };
            }
        }
        // --- FAIL-CLOSED: No cryptographic policy = no execution ---
        return { decision: 'deny', reason: '[TERMINAL REFUSAL] Missing Cryptographic Policy. Zero-Trust Gateway defaults to Fail-Closed.', ttl: 0 };
    }
}
