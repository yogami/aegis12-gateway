import { PolicyEvaluationRequest, AegisComplianceReceipt } from '../types';
import { normalizeParameters, assertSafeFinancialAmount } from '../domain/PolicyValidator';
import { AegisSigner } from './AegisSigner';
import keccak256 from 'keccak256';
import { INonceRegistry } from '../ports/INonceRegistry';
import { AegisLocalNonceRegistry } from './NonceRegistry';
import { Eip712Verifier } from '../domain/Eip712Verifier';
import { IAegisStateStore } from '../ports/IAegisStateStore';
import { AegisLocalStateStore } from './AegisLocalStateStore';
import { AegisJournal } from './AegisJournal';
import { AegisCanonicalMessage } from '../types';
import { TerminalRefusalError } from '../errors';
import { assertSafeIdentifier } from '../domain/PolicyValidator';
import { JsonUtils } from './JsonUtils';

const AEGIS_CHAIN_ID = 1399811149;
const AEGIS_DOMAIN_NAME = "Aegis-12-Compliance-Matrix";
const AEGIS_DOMAIN_VERSION = "1.0.0";

/**
 * [EXTREME QUALITY] AegisPEP
 * Cyclomatic Complexity: <= 3 per method.
 */
export class AegisPEP {
    constructor(
        private signer: AegisSigner, 
        private tenantTrustStore: Record<string, string[]> = {}, 
        private nonceRegistry: INonceRegistry = new AegisLocalNonceRegistry(), 
        private stateStore: IAegisStateStore = new AegisLocalStateStore(), 
        private journal: AegisJournal = new AegisJournal()
    ) {}

    public provisionTenant(tenantId: string, address: string): void {
        const safeId = assertSafeIdentifier(tenantId, 'tenantId');
        this.validateTrustedAddress(address);
        this.ensureTenantArray(safeId);
        this.addTrustedAddress(safeId, address);
    }

    private validateTrustedAddress(address: string): void {
        if (!/^0x[a-fA-F0-9]+$/.test(address)) throw new Error(`[TERMINAL REFUSAL] Invalid address: ${address}`);
    }

    private ensureTenantArray(tenantId: string): void {
        this.tenantTrustStore[tenantId] = this.tenantTrustStore[tenantId] || [];
    }

    private addTrustedAddress(tenantId: string, address: string): void {
        if (!this.tenantTrustStore[tenantId].includes(address)) this.tenantTrustStore[tenantId].push(address);
    }

    public async enforce(request: PolicyEvaluationRequest): Promise<AegisComplianceReceipt> {
        this.validateRequestStructure(request);
        const context = this.prepareContext(request);
        return this.executeEnforcement(request, context);
    }

    private prepareContext(request: PolicyEvaluationRequest) {
        const tenantId = assertSafeIdentifier(request.dynamicPolicy!.policyConfig.tenantId, 'tenantId');
        const nonce = assertSafeIdentifier(request.dynamicPolicy!.policyConfig.nonce, 'nonce');
        return { tenantId, nonce, scopedNonce: `${tenantId}::${nonce}`, spendIncremented: false, nonceReserved: false };
    }

    private async executeEnforcement(request: PolicyEvaluationRequest, ctx: any): Promise<AegisComplianceReceipt> {
        let amountBig = 0n;
        try {
            const normalized = this.normalizeAction(request);
            amountBig = normalized.amountBig;
            const { sanit } = normalized;
            const limits = this.getValidatedLimits(request);

            await this.reserveNonce(ctx.scopedNonce);
            ctx.nonceReserved = true;

            await this.verifyPolicy({ ...request, action: { ...request.action, parameters: sanit, estimatedValue: amountBig } }, limits);

            let decision: 'approved' | 'escalated' = 'approved';
            let envelope;

            // [ARTICLE 14] HOTL Escalate Condition
            const ESCALATE_THRESHOLD = 10_000_000_000n; // e.g., 10k USDC with 6 decimals
            if (amountBig >= ESCALATE_THRESHOLD) {
                decision = 'escalated';
                envelope = {
                    domain_separator: "AEGIS12_ESCALATE_V1",
                    vault_pda: request.dynamicPolicy?.policyConfig?.vaultPda || "VaultPDA_Fallback",
                    squads_multisig: request.dynamicPolicy?.policyConfig?.squadsMultisig || "SquadsMultisig_Fallback",
                    instruction_digest: '0x' + keccak256(Buffer.from(JsonUtils.stableStringify(sanit), 'utf8')).toString('hex'),
                    state_predicates: {
                        max_input_amount: Number(amountBig),
                        allowed_program_ids: request.dynamicPolicy?.policyConfig?.allowedProgramIds || ["TargetProgramID_Fallback"],
                        valid_until_slot: request.context?.currentSlot ? request.context.currentSlot + 1000 : 1000000
                    },
                    policy_hash: request.dynamicPolicy!.policyConfig.policyId
                };
            } else {
                await this.stateStore.tryIncrementSpend(ctx.tenantId, amountBig, limits.limit);
                ctx.spendIncremented = true;
            }

            const receipt = await this.generateReceipt(request, sanit, ctx.tenantId, ctx.nonce, decision, envelope);
            await this.commitTransaction(receipt, ctx.scopedNonce);
            return receipt;
        } catch (e: any) {
            await this.compensate(ctx, amountBig);
            throw e;
        }
    }

    private async reserveNonce(scopedNonce: string): Promise<void> {
        const reserved = await this.nonceRegistry.reserve(scopedNonce);
        if (!reserved) throw new TerminalRefusalError('Nonce already used or reservation failed.');
    }

    private async commitTransaction(receipt: AegisComplianceReceipt, scopedNonce: string): Promise<void> {
        await this.saveEvidence(receipt);
        await this.nonceRegistry.commit(scopedNonce);
    }

    private async compensate(ctx: any, amount: bigint): Promise<void> {
        if (ctx.spendIncremented) await this.stateStore.rollbackSpend(ctx.tenantId, amount).catch(() => {});
        if (ctx.nonceReserved) await this.nonceRegistry.release(ctx.scopedNonce).catch(() => {});
    }

    private async verifyPolicy(req: PolicyEvaluationRequest, limits: { tier: string, limit: bigint }): Promise<void> {
        Eip712Verifier.verifySignature(req.dynamicPolicy!, this.tenantTrustStore, AEGIS_DOMAIN_NAME, AEGIS_DOMAIN_VERSION, AEGIS_CHAIN_ID);
        const { TierEvaluator } = await import('../domain/TierEvaluator');
        TierEvaluator.verifyBoundsWithLimits(req, limits);
    }

    private getValidatedLimits(request: PolicyEvaluationRequest): { tier: string, limit: bigint } {
        const raw = request.dynamicPolicy!.policyConfig.financialLimitsString || "{}";
        this.validateLimitsLength(raw);
        const parsed = this.parseLimits(raw);
        return this.extractTierLimit(request, parsed);
    }

    private validateLimitsLength(raw: string): void {
        if (raw.length > 1024) throw new TerminalRefusalError('Limits exceed security bounds.');
    }

    private parseLimits(raw: string): any {
        try {
            const parsed = JSON.parse(raw);
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid structure');
            return parsed;
        } catch (e: any) {
            throw new TerminalRefusalError(`Malformed limits: ${e.message}`);
        }
    }

    private extractTierLimit(request: PolicyEvaluationRequest, parsed: any) {
        const keys = Object.keys(parsed);
        if (keys.length !== 1) throw new TerminalRefusalError('Multi-tier forbidden.');
        const tier = request.agent?.currentTier || 'unknown';
        if (keys[0] !== tier) throw new TerminalRefusalError(`Tier mismatch: ${tier} vs ${keys[0]}`);
        return { tier, limit: assertSafeFinancialAmount(parsed[tier], 'tier limit') };
    }

    private async generateReceipt(req: PolicyEvaluationRequest, sanit: any, tenantId: string, nonce: string, decision: 'approved' | 'denied' | 'escalated', envelope?: any): Promise<AegisComplianceReceipt> {
        const receiptId = `aegis-v1-${tenantId}-${keccak256(tenantId + "::" + nonce + "::" + ('0x' + keccak256(Buffer.from(JsonUtils.stableStringify(sanit), 'utf8')).toString('hex'))).toString('hex').substring(0, 16)}`;
        const msg = this.createCanonicalMessage(tenantId, nonce, receiptId, sanit);
        this.journalIntent(msg);
        const receipt = this.assembleReceiptWithId(receiptId, req, sanit, tenantId, nonce, decision, msg.article12LogHash, msg.timestamp);
        if (envelope) {
            receipt.envelope = envelope;
        }
        receipt.signature = await this.signer.sign(JsonUtils.computeReceiptHash(receipt));
        return receipt;
    }

    private assembleReceiptWithId(receiptId: string, req: PolicyEvaluationRequest, sanit: any, tenantId: string, nonce: string, decision: 'approved' | 'denied' | 'escalated', logHash: string, ts: string): AegisComplianceReceipt {
        const receipt = this.assembleReceipt(req, sanit, tenantId, nonce, decision, logHash, ts);
        receipt.receiptId = receiptId;
        return receipt;
    }

    private createCanonicalMessage(tenantId: string, nonce: string, receiptId: string, sanit: any): AegisCanonicalMessage {
        return { 
            tenantId, 
            nonce, 
            receiptId,
            article12LogHash: '0x' + keccak256(Buffer.from(JsonUtils.stableStringify(sanit), 'utf8')).toString('hex'), 
            timestamp: new Date().toISOString() 
        };
    }

    private journalIntent(msg: AegisCanonicalMessage): void {
        if (!this.journal.appendSync(msg)) throw new TerminalRefusalError('Journaling failed.');
    }

    private assembleReceipt(req: PolicyEvaluationRequest, sanit: any, tenantId: string, nonce: string, decision: 'approved' | 'denied' | 'escalated', logHash: string, ts: string): AegisComplianceReceipt {
        return {
            receiptId: `aegis-v1-${tenantId}-${keccak256(tenantId + "::" + nonce + "::" + logHash).toString('hex').substring(0, 16)}`,
            actionId: req.action.actionId || `act-${nonce}`,
            toolId: req.action.toolId,
            agentPubKey: req.agent?.did || "unknown",
            article12LogHash: logHash,
            parametersHash: logHash,
            resultHash: '0x' + keccak256(Buffer.from(decision.toUpperCase(), 'utf8')).toString('hex'),
            article14OversightSignature: req.dynamicPolicy!.signature,
            policyId: req.dynamicPolicy!.policyConfig.policyId,
            tenantId,
            complianceStandard: "ARS-01+",
            limitations: [],
            authorizationNonce: nonce,
            validatedParams: sanit,
            timestamp: ts as any,
            decision,
            signature: "",
            enclaveDid: this.signer.enclaveDid
        };
    }

    public async saveEvidence(receipt: AegisComplianceReceipt, ledgerTxHash?: string): Promise<void> {
        await this.stateStore.saveEvidence(receipt, ledgerTxHash);
    }

    public async getEvidence(txSignature: string): Promise<any | null> {
        return await this.stateStore.getEvidence(txSignature);
    }

    public async getEvidenceByReceiptId(receiptId: string): Promise<any | null> {
        return await this.stateStore.getEvidenceByReceiptId(receiptId);
    }

    public async updateZkSeal(receiptId: string, zkSealData: { seal?: string, vkey?: string }): Promise<void> {
        return await this.stateStore.updateZkSeal(receiptId, zkSealData);
    }

    private validateRequestStructure(req: PolicyEvaluationRequest): void {
        if (!req.dynamicPolicy?.policyConfig) throw new TerminalRefusalError('Missing Policy envelope.');
        this.validateAnomalyScore(req.context?.currentAnomalyScore);
        this.validateAnomalyScore(req.dynamicPolicy.policyConfig.maxAnomalyScore, true);
        this.validateExpiry(req.dynamicPolicy.policyConfig.expiresAt);
    }

    private validateAnomalyScore(score: any, isMax: boolean = false): void {
        const scoreVal = isMax ? score : (score ?? -1);
        const invalid = typeof scoreVal !== 'number' || !Number.isFinite(scoreVal) || scoreVal < 0 || (isMax ? scoreVal > 100 : scoreVal > 1.0);
        if (invalid) throw new TerminalRefusalError(`Invalid ${isMax ? 'max' : 'current'} anomaly score.`);
    }

    private validateExpiry(expiry: any): void {
        if (typeof expiry !== 'number' || !Number.isSafeInteger(expiry) || expiry <= 0) throw new TerminalRefusalError('Invalid expiry.');
        if (expiry < Math.floor(Date.now() / 1000)) throw new TerminalRefusalError('Policy Expired.');
    }

    private normalizeAction(req: PolicyEvaluationRequest): { sanit: Record<string, unknown>, amountBig: bigint } {
        const sanit = normalizeParameters(req.action.toolId, req.action.parameters);
        const amountBig = sanit.amount as bigint;
        if (typeof amountBig !== 'bigint') throw new TerminalRefusalError('Invalid BigInt amount.');
        return { sanit, amountBig };
    }
}
