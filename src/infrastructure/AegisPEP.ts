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

    public provisionTenant(tenantId: string, address: string): void {
        if (!this.tenantTrustStore[tenantId]) {
            this.tenantTrustStore[tenantId] = [];
        }
        if (!this.tenantTrustStore[tenantId].includes(address)) {
            this.tenantTrustStore[tenantId].push(address);
        }
    }



    private async validateNonceAndScore(request: PolicyEvaluationRequest, scopedNonce: string): Promise<void> {
        if (!request.dynamicPolicy) throw new Error('[TERMINAL REFUSAL] Missing Cryptographic Policy envelope.');
        
        if (!(await this.nonceRegistry.reserve(scopedNonce))) {
             throw new Error('[TERMINAL REFUSAL] Nonce already used or reservation failed. Replay detected.');
        }

        const score = request.context?.currentAnomalyScore;
        const isScoreInvalid = score === undefined || !Number.isFinite(score) || score < 0 || score > 1.0;
        if (isScoreInvalid) {
            await this.nonceRegistry.release(scopedNonce);
            throw new Error('[TERMINAL REFUSAL] Invalid or unscaled contextual anomaly score.');
        }

        if (request.dynamicPolicy.policyConfig.expiresAt < Math.floor(Date.now() / 1000)) {
            await this.nonceRegistry.release(scopedNonce);
            throw new Error('[TERMINAL REFUSAL] Policy Expired.');
        }
    }

    private getEstimatedValue(sanit: Record<string, unknown>, scopedNonce: string): bigint {
        try {
            return BigInt(sanit.amount as any || 0);
        } catch (e) {
            this.nonceRegistry.release(scopedNonce).catch(() => {});
            throw new Error(`[TERMINAL REFUSAL] Invalid amount format. Must be a valid BigInt string.`);
        }
    }

    private async executeBreaker(evalRequest: PolicyEvaluationRequest, scopedNonce: string): Promise<void> {
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
    }

    private async enforceLimits(request: PolicyEvaluationRequest, tenantId: string, spendAmountBig: bigint, scopedNonce: string): Promise<void> {
        const currentStats = await this.stateStore.getStats(tenantId);
        const currentTotalBig = BigInt(Math.floor(currentStats.totalSpend));
        const projectedSpendBig = currentTotalBig + spendAmountBig;
        
        const rawLimitsStr = request.dynamicPolicy!.policyConfig.financialLimitsString || "{}";
        const verifiedLimits = JSON.parse(rawLimitsStr);
        
        let lifetimeLimitBig = 9999999999n;
        const tier = request.agent?.currentTier || 'unknown';
        
        if (verifiedLimits.perTx !== undefined) {
            lifetimeLimitBig = BigInt(verifiedLimits.perTx);
        } else if (verifiedLimits[tier] !== undefined) {
            lifetimeLimitBig = BigInt(verifiedLimits[tier]);
        }
        
        if (projectedSpendBig > lifetimeLimitBig) {
            await this.nonceRegistry.release(scopedNonce);
            throw new Error(`[TERMINAL REFUSAL] Cumulative spend (${projectedSpendBig}) would exceed hardware-locked lifetime ceiling`);
        }

        if (projectedSpendBig > BigInt(Number.MAX_SAFE_INTEGER)) {
             await this.nonceRegistry.release(scopedNonce);
             throw new Error(`[TERMINAL REFUSAL] Wallet balance has exceeded MAX_SAFE_INTEGER.`);
        }
    }

    private async generateReceipt(request: PolicyEvaluationRequest, sanit: Record<string, unknown>, tenantId: string, nonce: string): Promise<AegisComplianceReceipt> {
        const receipt: AegisComplianceReceipt = {
            receiptId: `aegis-v1-${Date.now()}`,
            actionId: `act-${nonce}`,
            toolId: request.action.toolId,
            agentPubKey: request.agent?.did || "unknown",
            article12LogHash: ethers.utils.id(JSON.stringify(sanit)),
            parametersHash: ethers.utils.id(JSON.stringify(sanit)),
            resultHash: ethers.utils.id("ALLOW"),
            article14OversightSignature: request.dynamicPolicy!.signature,
            policyId: request.dynamicPolicy!.policyConfig.policyId,
            tenantId: tenantId,
            complianceStandard: "ARS-01+",
            limitations: [],
            authorizationNonce: nonce,
            validatedParams: sanit,
            timestamp: new Date().toISOString() as any,
            signature: ""
        };

        const signableReceipt = {
            ...receipt,
            validatedParamsJson: JSON.stringify(sanit),
            limitationsJson: JSON.stringify(receipt.limitations),
            zkSeal: (receipt as any).zkSeal || "none"
        };

        receipt.signature = await this.signer.signEIP712({ name: AEGIS_DOMAIN_NAME, version: AEGIS_DOMAIN_VERSION, chainId: AEGIS_CHAIN_ID }, { AegisComplianceReceipt: [
            { name: 'receiptId', type: 'string' }, { name: 'actionId', type: 'string' }, { name: 'toolId', type: 'string' },
            { name: 'agentPubKey', type: 'string' }, { name: 'article12LogHash', type: 'string' }, { name: 'parametersHash', type: 'string' },
            { name: 'resultHash', type: 'string' }, { name: 'article14OversightSignature', type: 'string' }, { name: 'policyId', type: 'string' },
            { name: 'tenantId', type: 'string' }, { name: 'complianceStandard', type: 'string' }, { name: 'authorizationNonce', type: 'string' },
            { name: 'timestamp', type: 'string' }, { name: 'validatedParamsJson', type: 'string' }, { name: 'limitationsJson', type: 'string' },
            { name: 'zkSeal', type: 'string' }
        ]}, signableReceipt);

        return receipt;
    }

    public async saveEvidence(receipt: AegisComplianceReceipt, solanaTx?: string): Promise<void> {
        await this.stateStore.saveEvidence(receipt, solanaTx);
    }

    public async getEvidence(txSignature: string): Promise<any | null> {
        return await this.stateStore.getEvidence(txSignature);
    }

    public async enforce(request: PolicyEvaluationRequest): Promise<AegisComplianceReceipt> {
        if (!request.dynamicPolicy) throw new Error('[TERMINAL REFUSAL] Missing Cryptographic Policy envelope.');
        
        const tenantId = request.dynamicPolicy.policyConfig.tenantId;
        const nonce = request.dynamicPolicy.policyConfig.nonce;
        const scopedNonce = `${tenantId}::${nonce}`;

        await this.validateNonceAndScore(request, scopedNonce);

        let sanit;
        try {
            sanit = normalizeParameters(request.action.toolId, request.action.parameters);
        } catch (e: any) {
            await this.nonceRegistry.release(scopedNonce);
            throw new Error(`Action denied by Aegis Enclave: ${e.message}`);
        }
        const estimatedValueBig = this.getEstimatedValue(sanit, scopedNonce);
        const estimatedValue = Number(estimatedValueBig);
        
        const evalRequest = { ...request, action: { ...request.action, parameters: sanit, estimatedValue } };

        await this.executeBreaker(evalRequest, scopedNonce);

        let spendAmountBig = 0n;
        try { spendAmountBig = BigInt(sanit.amount as any || 0); } catch(e) {}
        
        await this.enforceLimits(request, tenantId, spendAmountBig, scopedNonce);

        await this.nonceRegistry.commit(scopedNonce);
        await this.stateStore.updateStats(tenantId, Number(spendAmountBig));

        return this.generateReceipt(request, sanit, tenantId, nonce);
    }
}
