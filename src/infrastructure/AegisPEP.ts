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
import { OfacValidator } from '../domain/OfacValidator';
import { SimulationEngine } from './SimulationEngine';
import * as fs from 'fs';
import * as path from 'path';

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
        if (!/^0x[a-fA-F0-9]+$/.test(address)) throw new TerminalRefusalError(`[TERMINAL REFUSAL] Invalid address: ${address}`);
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

            this.sanitizeContext(request);

            await this.reserveNonce(ctx.scopedNonce);
            ctx.nonceReserved = true;

            await this.verifySignatureAndAnomaly({ ...request, action: { ...request.action, parameters: sanit, estimatedValue: amountBig } });
            await SimulationEngine.simulateAndParse(sanit);

            const { decision, envelope } = await this.evaluateEscalation(amountBig, request, sanit, limits, ctx);

            const receipt = await this.generateReceipt(request, sanit, ctx.tenantId, ctx.nonce, decision, envelope);
            await this.commitTransaction(receipt, ctx.scopedNonce);
            return receipt;
        } catch (e: any) {
            await this.compensate(ctx, amountBig);
            throw e;
        }
    }

    private sanitizeContext(request: PolicyEvaluationRequest): void {
        if (request.agentContext?.prompt) {
            const promptUpper = request.agentContext.prompt.toUpperCase();
            if (promptUpper.includes('IGNORE ALL PREVIOUS INSTRUCTIONS') || promptUpper.includes('MALICIOUS_INTENT')) {
                throw new TerminalRefusalError('Malicious intent detected in context prompt.');
            }
        }
    }

    private async evaluateEscalation(amountBig: bigint, request: PolicyEvaluationRequest, sanit: any, limits: any, ctx: any) {
        const ESCALATE_THRESHOLD = 10_000_000_000n;
        if (amountBig >= ESCALATE_THRESHOLD) {
            return { decision: 'escalated' as const, envelope: this.buildEscalationEnvelope(amountBig, request, sanit) };
        } else {
            await this.verifyTierLimit({ ...request, action: { ...request.action, parameters: sanit, estimatedValue: amountBig } }, limits);
            await this.stateStore.tryIncrementSpend(ctx.tenantId, amountBig, limits.limit);
            ctx.spendIncremented = true;
            return { decision: 'approved' as const, envelope: undefined };
        }
    }

    private buildEscalationEnvelope(amountBig: bigint, request: PolicyEvaluationRequest, sanit: any) {
        const config = request.dynamicPolicy?.policyConfig;
        return {
            domain_separator: "AEGIS12_ESCALATE_V1",
            vault_pda: config?.vaultPda || "VaultPDA_Fallback",
            squads_multisig: config?.squadsMultisig || "SquadsMultisig_Fallback",
            instruction_digest: '0x' + keccak256(Buffer.from(JsonUtils.stableStringify(sanit), 'utf8')).toString('hex'),
            state_predicates: this.buildStatePredicates(amountBig, request, config),
            policy_hash: config?.policyId || "unknown"
        };
    }

    private buildStatePredicates(amountBig: bigint, request: PolicyEvaluationRequest, config: any) {
        return {
            max_input_amount: amountBig.toString(),
            allowed_program_ids: config?.allowedProgramIds || ["TargetProgramID_Fallback"],
            valid_until_slot: request.context?.currentSlot ? request.context.currentSlot + 1000 : 1000000
        };
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

    /**
     * [PHASE 1] Verify EIP-712 signature integrity + anomaly score.
     * MUST run before the Article 14 escalation decision.
     */
    private async verifySignatureAndAnomaly(req: PolicyEvaluationRequest): Promise<void> {
        Eip712Verifier.verifySignature(req.dynamicPolicy!, this.tenantTrustStore, AEGIS_DOMAIN_NAME, AEGIS_DOMAIN_VERSION, AEGIS_CHAIN_ID);
        const { TierEvaluator } = await import('../domain/TierEvaluator');
        TierEvaluator.verifyAnomalyOnly(req);
    }

    /**
     * [PHASE 2] Verify tier spending limit.
     * Only called for non-escalated (autonomous) transactions.
     */
    private async verifyTierLimit(req: PolicyEvaluationRequest, limits: { tier: string, limit: bigint }): Promise<void> {
        const { TierEvaluator } = await import('../domain/TierEvaluator');
        TierEvaluator.verifyValueLimit(req, limits);
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
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TerminalRefusalError('Invalid structure');
            return parsed;
        } catch (e: any) {
            throw new TerminalRefusalError(`Malformed limits: ${e.message}`);
        }
    }

    private extractTierLimit(request: PolicyEvaluationRequest, parsed: any) {
        const keys = Object.keys(parsed);
        if (keys.length !== 1) throw new TerminalRefusalError('Multi-tier limit objects are structurally unsafe.');
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
        await this.signReceipt(receipt);
        return receipt;
    }

    public async signReceipt(receipt: AegisComplianceReceipt): Promise<void> {
        receipt.signature = await this.signer.signEIP712(
            { name: AEGIS_DOMAIN_NAME, version: AEGIS_DOMAIN_VERSION, chainId: AEGIS_CHAIN_ID },
            {
                AegisComplianceReceipt: [
                    { name: 'receiptId', type: 'string' }, { name: 'actionId', type: 'string' }, { name: 'toolId', type: 'string' },
                    { name: 'agentPubKey', type: 'string' }, { name: 'article12LogHash', type: 'string' }, { name: 'parametersHash', type: 'string' },
                    { name: 'resultHash', type: 'string' }, { name: 'article14OversightSignature', type: 'string' }, { name: 'policyId', type: 'string' },
                    { name: 'tenantId', type: 'string' }, { name: 'complianceStandard', type: 'string' }, { name: 'authorizationNonce', type: 'string' },
                    { name: 'timestamp', type: 'string' }, { name: 'validatedParamsJson', type: 'string' }, { name: 'limitationsJson', type: 'string' },
                    { name: 'zkSeal', type: 'string' }
                ]
            },
            {
                ...receipt,
                validatedParamsJson: JSON.stringify(receipt.validatedParams, (key, value) => typeof value === 'bigint' ? value.toString() : value),
                limitationsJson: JSON.stringify(receipt.limitations),
                zkSeal: (receipt as any).zkSeal || "none"
            }
        );
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
        const receipt: AegisComplianceReceipt = {
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

        this.attachEvidencePackage(receipt, req, ts);
        this.attachPaymentHeader(receipt, req);
        return receipt;
    }

    private attachEvidencePackage(receipt: AegisComplianceReceipt, req: PolicyEvaluationRequest, ts: string): void {
        if (req.agentContext) {
            receipt.evidencePackage = {
                policyId: req.dynamicPolicy!.policyConfig.policyId,
                riskTier: req.agent?.currentTier || 'unknown',
                modelVersion: req.agentContext.modelVersion || 'unknown',
                jurisdiction: req.agentContext.jurisdiction || 'unknown',
                actionTaxonomy: req.action.toolId,
                intentHash: '0x' + keccak256(Buffer.from(req.agentContext.prompt || '', 'utf8')).toString('hex'),
                timestamp: Math.floor(new Date(ts).getTime() / 1000)
            };
        }
    }

    private attachPaymentHeader(receipt: AegisComplianceReceipt, req: PolicyEvaluationRequest): void {
        if ((req as any).x402PaymentHeader) {
            receipt.x402PaymentHeader = (req as any).x402PaymentHeader;
        }
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
        if (invalid) throw new TerminalRefusalError(`Invalid or unscaled contextual anomaly score.`);
    }

    private validateExpiry(expiry: any): void {
        if (typeof expiry !== 'number' || !Number.isSafeInteger(expiry) || expiry <= 0) throw new TerminalRefusalError('Invalid expiry.');
        if (expiry < Math.floor(Date.now() / 1000)) throw new TerminalRefusalError('Policy Expired.');
        this.checkEvictionWatermark(expiry);
    }

    private checkEvictionWatermark(expiry: number): void {
        try {
            const basePath = (this.stateStore as any)['dataDir'] ? path.resolve((this.stateStore as any)['dataDir'], '.aegis_wal') : path.resolve('/tmp', '.aegis_wal');
            const watermarkPath = `${basePath}_watermark.json`;
            if (fs.existsSync(watermarkPath)) {
                const data = JSON.parse(fs.readFileSync(watermarkPath, 'utf8'));
                if (data && typeof data.evictionWatermark === 'number' && expiry < data.evictionWatermark) {
                    throw new TerminalRefusalError('Policy rejected by Eviction Watermark (Anti-Replay).');
                }
            }
        } catch (e: any) {
            if (e instanceof TerminalRefusalError) throw e;
            console.warn(`[AegisPEP] Failed to read watermark: ${e.message}`);
        }
    }

    private normalizeAction(req: PolicyEvaluationRequest): { sanit: Record<string, unknown>, amountBig: bigint } {
        const sanit = normalizeParameters(req.action.toolId, req.action.parameters);
        OfacValidator.inspectParameters(sanit); // Deterministic OFAC/Sanctions Kill Switch
        const amountBig = sanit.amount as bigint;
        if (typeof amountBig !== 'bigint') throw new TerminalRefusalError('Invalid BigInt amount.');
        return { sanit, amountBig };
    }
}
