import fetch from 'node-fetch';

export interface AegisConfig {
    gatewayUrl: string;
    agentId: string;
    tenantId: string;
    agentTier?: string;
    timeoutMs?: number;
    /**
     * EIP-712 policy signature provided by the tenant's authorized signer.
     * This MUST be a real cryptographic signature — the gateway will verify it
     * against the tenant's provisioned trust store.
     */
    policySignature: string;
    /**
     * Current anomaly score for this agent, computed by the caller's
     * behavioral monitoring system. Range: [0.0, 1.0].
     * The gateway uses this for risk-tiered enforcement decisions.
     */
    currentAnomalyScore?: number;
}

/**
 * withAegis — The official SDK wrapper for Aegis-12 compliance.
 * 
 * This higher-order function wraps an agent's action and ensures it is
 * verified by the Aegis TEE Gateway before execution.
 * 
 * @experimental This SDK requires a valid EIP-712 policy signature.
 * Without one, the gateway will reject all requests.
 * 
 * IMPORTANT: There is no fallback path. If the gateway is unreachable,
 * the action is NOT executed. This is fail-closed by design.
 */
export function withAegis(action: Function, config: AegisConfig) {
    if (!config.policySignature || config.policySignature.length < 10) {
        throw new Error('[Aegis SDK] policySignature is required. The gateway will reject requests without a valid EIP-712 signature.');
    }

    return async (...args: any[]) => {
        const timeoutMs = config.timeoutMs || 5000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const agentAction = await action(...args);
            
            const payload = {
                agent: {
                    id: config.agentId,
                    tenantId: config.tenantId,
                    currentTier: config.agentTier || 'T1'
                },
                action: {
                    toolId: agentAction.toolId || 'unknown',
                    parameters: agentAction.parameters || agentAction
                },
                context: {
                    timestamp: new Date().toISOString(),
                    currentAnomalyScore: config.currentAnomalyScore ?? 0.5
                },
                dynamicPolicy: {
                    signature: config.policySignature,
                    policyConfig: {
                        policyId: `${config.tenantId}-policy`,
                        tenantId: config.tenantId,
                        nonce: Date.now().toString(),
                        expiresAt: Math.floor(Date.now() / 1000) + 3600,
                        financialLimitsString: "{}"
                    }
                }
            };

            const response = await fetch(`${config.gatewayUrl}/enforce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown Gateway Error' }));
                throw new Error(`Aegis Enforcement Rejected: ${errorData.error || response.statusText}`);
            }

            const decision = await response.json();
            return {
                ...agentAction,
                decision: decision.status === 'approved' ? 'ALLOW' : 'DENY',
                receipt: decision.receipt,
                solanaTx: decision.solana_tx
            };

        } catch (err: any) {
            clearTimeout(timeout);
            // Fail-closed: if gateway is unreachable, the action is NOT executed.
            // There is no fallback. This is a security boundary, not a convenience wrapper.
            throw err;
        }
    };
}
