import { AegisConfig, EvidencePackage, PoIAttestationHeader } from './types';
import { getCircuitBreaker, CircuitBreaker } from '../../../src/infrastructure/CircuitBreaker';
import { TerminalRefusalError } from '../../../src/errors';

export class AegisX402Client {
    private config: AegisConfig;
    private breaker: CircuitBreaker;

    constructor(config: AegisConfig) {
        this.config = config;
        this.breaker = getCircuitBreaker(`x402-poi-${config.policyId}`, {
            failureThreshold: 2,
            recoveryTimeMs: 10_000
        });
    }

    /**
     * Internal method to validate intent against the active policy.
     * In a production environment, this calls the Phala CVM enclave.
     */
    private async evaluateIntent(prompt: string, context: any): Promise<EvidencePackage> {
        // Mocking the <50ms TEE enclave execution
        // If the intent is malicious or violates policy, throw TerminalRefusalError
        if (prompt.includes("malicious_intent") || prompt.includes("bypass_policy")) {
            throw new TerminalRefusalError(`Intent violates active policy: ${this.config.policyId}`);
        }

        // Return the human-readable evidence package
        return {
            policyId: this.config.policyId,
            riskTier: 'Tier_3_High',
            modelVersion: 'Llama-3.1-70B-Instruct',
            jurisdiction: 'EU_MiCA',
            actionTaxonomy: 'DeFi_Transfer_Outbound',
            intentHash: 'mock_sha256_hash_of_intent',
            timestamp: Date.now()
        };
    }

    /**
     * Intercepts standard fetch options and injects the PoI-Attestation header.
     * This acts as the Active Circuit Breaker for x402 payments.
     */
    public async injectPoI(prompt: string, context: any, requestOptions: RequestInit): Promise<RequestInit> {
        return await this.breaker.execute(async () => {
            const evidence = await this.evaluateIntent(prompt, context);
            
            const attestation: PoIAttestationHeader = {
                evidence,
                enclaveSignature: 'mock_phala_cvm_signature_sub_50ms',
                zkAnchoringStatus: 'pending' // Asynchronous anchoring
            };

            const headers = new Headers(requestOptions.headers);
            headers.set('PoI-Attestation', JSON.stringify(attestation));

            return {
                ...requestOptions,
                headers
            };
        });
    }
}
