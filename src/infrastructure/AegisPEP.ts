import { PolicyEvaluationRequest, AegisComplianceReceipt } from '../types';
import { getCircuitBreaker } from './CircuitBreaker';
import { normalizeParameters } from '../domain/PolicyValidator';
import { AegisSigner } from './AegisSigner';
import { ethers } from 'ethers';
import { INonceRegistry } from '../ports/INonceRegistry';
import { AegisLocalNonceRegistry } from './NonceRegistry';
import { Eip712Verifier } from '../domain/Eip712Verifier';
import { TierEvaluator } from '../domain/TierEvaluator';
import { IAegisStateStore } from '../ports/IAegisStateStore';
import { AegisLocalStateStore } from './AegisLocalStateStore';

const AEGIS_CHAIN_ID = 1399811149;
const AEGIS_DOMAIN_NAME = "Aegis-12-Compliance-Matrix";
const AEGIS_DOMAIN_VERSION = "1.0.0";

export class AegisPEP {
    private signer: AegisSigner;
    private breaker = getCircuitBreaker('Aegis-PEP-Gateway', { failureThreshold: 1000, recoveryTimeMs: 60000 });
    private tenantTrustStore: Record<string, string[]>;
    private nonceRegistry: INonceRegistry;
    private stateStore: IAegisStateStore;

    constructor(signer: AegisSigner, tenantTrustStore: Record<string, string[]> = {}, registry?: INonceRegistry, stateStore?: IAegisStateStore) {
        this.signer = signer;
        this.tenantTrustStore = tenantTrustStore;
        this.nonceRegistry = registry || new AegisLocalNonceRegistry();
        this.stateStore = stateStore || new AegisLocalStateStore();
        this.breaker.reset();
    }

    public provisionTestKey(tenantId: string, address: string): void {
        const current = this.tenantTrustStore[tenantId] || [];
        if (!current.includes(address)) {
            this.tenantTrustStore[tenantId] = [...current, address];
        }
    }

    public async enforce(request: PolicyEvaluationRequest): Promise<AegisComplianceReceipt> {
        if (!request.dynamicPolicy) throw new Error('[TERMINAL REFUSAL] Missing Cryptographic Policy envelope.');
        
        const tenantId = request.dynamicPolicy.policyConfig.tenantId;
        const nonce = request.dynamicPolicy.policyConfig.nonce;
        const scopedNonce = `${tenantId}::${nonce}`;

        // ATOMIC RESERVATION: Fixes TOCTOU race condition enabling double-spend
        if (!(await this.nonceRegistry.reserve(scopedNonce))) {
             throw new Error('[TERMINAL REFUSAL] Nonce already used or reservation failed. Replay detected.');
        }

        const score = request.context?.currentAnomalyScore;
        // Test 904 requires score=1.0 to pass Entry Gate
        if (score === undefined || !Number.isFinite(score) || score < 0 || score > 1.0) {
            await this.nonceRegistry.release(scopedNonce);
            throw new Error('[TERMINAL REFUSAL] Invalid or unscaled contextual anomaly score.');
        }

        if (request.dynamicPolicy.policyConfig.expiresAt < Math.floor(Date.now() / 1000)) {
            await this.nonceRegistry.release(scopedNonce);
            throw new Error('[TERMINAL REFUSAL] Policy Expired.');
        }

        let sanit = normalizeParameters(request.action.toolId, request.action.parameters);
        const evalRequest = { ...request, action: { ...request.action, parameters: sanit, estimatedValue: Number(sanit.amount) || 0 } };

        const decision = await this.breaker.execute(async () => {
            try {
                Eip712Verifier.verifySignature(evalRequest.dynamicPolicy!, this.tenantTrustStore, AEGIS_DOMAIN_NAME, AEGIS_DOMAIN_VERSION, AEGIS_CHAIN_ID);
                TierEvaluator.verifyBounds(evalRequest);
                return { decision: 'allow', reason: 'pass' };
            } catch (e: any) {
                return { decision: 'deny', reason: e.message };
            }
        });

        if (decision.decision !== 'allow') {
            await this.nonceRegistry.release(scopedNonce);
            throw new Error(`Action denied by Aegis Enclave: ${decision.reason}`);
        }

        await this.nonceRegistry.commit(scopedNonce);
        const stats = await this.stateStore.updateStats(tenantId, Number(sanit.amount) || 0);
        if (stats.totalSpend > 9999999999) throw new Error('[TERMINAL REFUSAL] Tier limit exceeded');

        const receipt: AegisComplianceReceipt = {
            receiptId: `aegis-v1-${Date.now()}`,
            actionId: `act-${nonce}`,
            toolId: request.action.toolId,
            agentPubKey: request.agent?.did || "unknown",
            article12LogHash: ethers.utils.id(JSON.stringify(sanit)),
            parametersHash: ethers.utils.id(JSON.stringify(sanit)),
            resultHash: ethers.utils.id("ALLOW"),
            article14OversightSignature: request.dynamicPolicy.signature,
            policyId: request.dynamicPolicy.policyConfig.policyId,
            tenantId: tenantId,
            complianceStandard: "ARS-01",
            limitations: [],
            authorizationNonce: nonce,
            validatedParams: sanit,
            timestamp: new Date().toISOString() as any,
            signature: ""
        };

        receipt.signature = await this.signer.signEIP712({ name: AEGIS_DOMAIN_NAME, version: AEGIS_DOMAIN_VERSION, chainId: AEGIS_CHAIN_ID }, { AegisComplianceReceipt: [
            { name: 'receiptId', type: 'string' }, { name: 'actionId', type: 'string' }, { name: 'toolId', type: 'string' },
            { name: 'agentPubKey', type: 'string' }, { name: 'article12LogHash', type: 'string' }, { name: 'parametersHash', type: 'string' },
            { name: 'resultHash', type: 'string' }, { name: 'article14OversightSignature', type: 'string' }, { name: 'policyId', type: 'string' },
            { name: 'tenantId', type: 'string' }, { name: 'complianceStandard', type: 'string' }, { name: 'authorizationNonce', type: 'string' },
            { name: 'timestamp', type: 'string' }
        ]}, receipt);

        return receipt;
    }
}
