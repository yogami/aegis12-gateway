import { PolicyEvaluationRequest } from '../types';
import { assertSafeFinancialAmount } from './PolicyValidator';

export class TierEvaluator {
    /**
     * Authenticates the anomaly constraints and financial limits from the parsed cryptographic policy.
     * Incorporates the DeepResearch structural anti-spoofing patches natively.
     * 
     * @throws {Error} if bounds are breached or structural bypass topologies are detected.
     */
    public static verifyBounds(request: PolicyEvaluationRequest): void {
        const { context, agent, dynamicPolicy, action } = request;
        const activePolicy = dynamicPolicy!.policyConfig;

        // --- PHASE 4 FIX: Normalize contextual float score (0.0-1.0) against signed integer limit (0-100) ---
        // VULN-003: Casting dynamically generated types securely to Numbers to eliminate Ethers String Coercion.
        // NEW-VULN-001: Explicitly prevent NaN casting bypass. If the anomaly score is undefined or a malicious structure, fail-closed natively.
        const secureScore = Number(activePolicy.maxAnomalyScore);
        if (isNaN(secureScore)) {
            throw new Error('[TERMINAL REFUSAL] maxAnomalyScore is missing or mathematically invalid. Fail-closed.');
        }
        const normalizedContextScore = context.currentAnomalyScore * 100;
        if (normalizedContextScore > secureScore) {
            throw new Error(`Anomaly score exceeds Dynamic TEE threshold (>${secureScore})`);
        }

        // --- COUNCIL FIX: BOUNDED FINANCIAL LIMITS STRING ---
        const rawLimitsStr = activePolicy.financialLimitsString || "{}";
        if (rawLimitsStr.length > 1024) {
            throw new Error("financialLimitsString exceeds 1024 byte safety bound (parser bomb defense)");
        }
        const verifiedLimits = JSON.parse(rawLimitsStr);

        // VULN-004: Eradicate explicit object defaults granting infinite permission.
        const limitKeys = Object.keys(verifiedLimits);
        if (limitKeys.length === 0) {
            throw new Error("[TERMINAL REFUSAL] Empty financial limits string explicitly forbidden. Fail-closed.");
        }
        
        // VULN-002: Multi-tier structs natively allow spoofing untrusted attributes across limits. Force singular bounding.
        // We ensure `agent.currentTier` explicitly lines up perfectly with what the administrator explicitly cryptographically attested.
        if (limitKeys.length !== 1) {
            throw new Error("[TERMINAL REFUSAL] Multi-tier limit objects are structurally unsafe. Signature must mathematically lock exactly one Tier attribute.");
        }

        const signedTier = limitKeys[0];
        if (agent.currentTier !== signedTier) {
            throw new Error(`[TERMINAL REFUSAL] Agent tier '${agent.currentTier}' does not perfectly match signed Tier '${signedTier}'. Identity Spoofing Detected. Default-deny.`);
        }

        const maxAllowedValue = verifiedLimits[signedTier];
        
        // --- COUNCIL FIX: INFINITY / 1e308 BYPASS PREVENTION ---
        assertSafeFinancialAmount(maxAllowedValue, "tier limits");

        const estimatedValue = BigInt(action.estimatedValue);
        const maxAllowedBig = BigInt(maxAllowedValue);

        if (estimatedValue > maxAllowedBig) {
            throw new Error(`Action value ${estimatedValue} exceeds mathematically signed Tier limit ${maxAllowedBig}`);
        }
    }
}
