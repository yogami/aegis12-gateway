
export interface AegisConfig {
    gatewayUrl?: string; // Defaults to the live Railway proxy
    agentId: string;
    tenantId: string;
    agentTier?: string;
    timeoutMs?: number;
    mandateSignature: string;
    currentAnomalyScore?: number;
}


export class AegisSDK {
    /**
     * @deprecated The 'withAegis' wrapper is deprecated. Agents must not hold private keys.
     * Use 'signAndExecute' instead for the Zero-Custody TEE Facilitator model.
     */
    static withAegis(action: Function, config: AegisConfig) {
        throw new Error('[Aegis SDK] withAegis is deprecated. You must use signAndExecute. Agents cannot hold private keys.');
    }

    /**
     * signAndExecute — The Drop-in SDK for the TEE Remote Signer.
     * The agent passes an unsigned intent. The Phala TEE enforces the AP2 Intent Mandate, signs the transaction securely,
     * submits via Jito ShredStream, and returns the tx_hash and Evidence Package.
     */
    static async signAndExecute(intent: any, config: AegisConfig) {
        const gatewayUrl = config.gatewayUrl || 'https://aegis12-dashboarduprailwayapp-production.up.railway.app';
        const timeoutMs = config.timeoutMs || 5000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const payload = AegisSDK._buildPayload(intent, config);
            const decision = await AegisSDK._postRequest(gatewayUrl, payload, controller);
            clearTimeout(timeout);
            return AegisSDK._formatResponse(decision);
        } catch (err: any) {
            clearTimeout(timeout);
            throw err;
        }
    }

    private static _buildPayload(intent: any, config: AegisConfig) {
        return {
            agent: { id: config.agentId, tenantId: config.tenantId, currentTier: config.agentTier || 'T1' },
            action: { toolId: intent.toolId || 'unsigned_transaction', parameters: intent.parameters || intent },
            context: { timestamp: new Date().toISOString(), currentAnomalyScore: config.currentAnomalyScore ?? 0.5 },
            mandateSignature: config.mandateSignature
        };
    }

    private static async _postRequest(gatewayUrl: string, payload: any, controller: AbortController) {
        const response = await fetch(`${gatewayUrl}/sign_and_execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal as any
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown Gateway Error' })) as any;
            throw new Error(`Aegis Fiduciary Escrow Rejected: ${errorData.error || response.statusText}`);
        }
        return await response.json() as any;
    }

    private static _formatResponse(decision: any) {
        if (decision.status !== 'approved' && decision.status !== 'escalated') {
            throw new Error(`Aegis Fiduciary Escrow Denied: ${decision.error || 'Intent Mandate Violation'}`);
        }
        return {
            status: decision.status,
            decision: decision.status === 'approved' ? 'ALLOW' : 'ESCALATED',
            tx_hash: decision.ledger_tx,
            evidence_package: decision.receipt?.evidencePackage,
            hardware_attestation: decision.attestation,
            envelope: decision.ars_anchor
        };
    }
}
