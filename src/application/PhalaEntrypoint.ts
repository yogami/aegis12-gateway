import { AegisSigner } from '../infrastructure/AegisSigner';
import { AegisPEP } from '../infrastructure/AegisPEP';
import { PolicyEvaluationRequest, AegisComplianceReceipt } from '../types';
import { ILedgerAnchor } from '../ports/ILedgerAnchor';
import { LedgerAnchorFactory } from '../infrastructure/LedgerAnchorFactory';
import { TelemetryTracker } from '../infrastructure/TelemetryTracker';
import { AegisJournal } from '../infrastructure/AegisJournal';
import { BatchAnchorWorker } from '../BatchAnchorWorker';
import { TappdClient } from '../infrastructure/TappdClient';
import { TerminalRefusalError } from '../errors';
import keccak256 from 'keccak256';
import { JsonUtils } from '../infrastructure/JsonUtils';
import { PepFactory } from './PepFactory';
import { Pcr0Verifier } from './Pcr0Verifier';
import { ZkProofGenerator } from './ZkProofGenerator';
import { SquadsRouter } from '../infrastructure/SquadsRouter';
import { IAegisVaultStore } from '../ports/IAegisVaultStore';
import { AegisLocalVaultStore } from '../infrastructure/AegisLocalVaultStore';

/**
 * [EXTREME QUALITY] PhalaEntrypoint
 * Cyclomatic Complexity: <= 3 per method.
 */
export class AegisEnclave {
    private static instance: AegisEnclave;
    private _signer?: AegisSigner;
    private _pep?: AegisPEP;
    private _anchor?: ILedgerAnchor;
    private _journal?: AegisJournal;
    private _batchWorker?: BatchAnchorWorker;
    private _vaultStore?: IAegisVaultStore;
    private _initPromise: Promise<void> | null = null;

    private constructor() {}

    public static getInstance(): AegisEnclave {
        AegisEnclave.instance = AegisEnclave.instance || new AegisEnclave();
        return AegisEnclave.instance;
    }

    public get signer() { return this._signer; }
    public get anchor() { return this._anchor; }
    public get pep() { return this._pep; }
    public get vaultStore() { return this._vaultStore; }

    public static reset(): void {
        AegisEnclave.instance?.stopWorker();
        AegisEnclave.instance = new AegisEnclave();
    }

    private stopWorker(): void {
        if (this._batchWorker) this._batchWorker.stop();
    }

    public async initialize(): Promise<void> {
        if (this.isReady()) return;
        if (this._initPromise) return this._initPromise;
        this._initPromise = this.startInitialization();
        return this._initPromise;
    }

    private isReady(): boolean {
        return [this._signer, this._pep, this._anchor, this._batchWorker, this._vaultStore].every(Boolean);
    }

    private async startInitialization(): Promise<void> {
        try {
            console.log("[Aegis-12] 🚀 Starting Hardware Enclave Initialization...");
            await this.doInitializeWithRetry(0);
            console.log("[Aegis-12] ✅ Enclave Fully Initialized.");
        } catch (err: any) {
            console.error(`[Aegis-12] ❌ Hardware Initialization Failed: ${err.message}`);
            this._initPromise = null;
            throw err;
        }
    }

    private async doInitializeWithRetry(attempt: number): Promise<void> {
        try {
            await this.performInitializationSteps();
        } catch (err: any) {
            this.handleInitError(err, attempt);
            await this.waitWithJitter(attempt + 1);
            return this.doInitializeWithRetry(attempt + 1);
        }
    }

    private handleInitError(err: any, attempt: number): void {
        console.error(`[Aegis-12] Init attempt ${attempt} failed: ${err.message}`);
        if (attempt >= 4) throw err;
    }

    private async performInitializationSteps(): Promise<void> {
        this._signer = this._signer || await AegisSigner.create();
        this._vaultStore = this._vaultStore || new AegisLocalVaultStore();
        await this.ensurePep();
        
        if (!this._anchor) {
            this._anchor = await LedgerAnchorFactory.create(this._signer!);
        }
    }

    private async ensurePep(): Promise<void> {
        if (this._pep) return;
        const result = await PepFactory.createPep(this._signer!);
        this._pep = result.pep;
        this._journal = result.journal;
    }

    private async ensureWorker(): Promise<void> {
        if (this._batchWorker) return;
        const worker = new BatchAnchorWorker(this._journal!, this._anchor!, this._signer!.enclaveDid, this._pep!);
        worker.start(30000);
        this._batchWorker = worker;
    }

    private async waitWithJitter(attempt: number): Promise<void> {
        const delay = (1000 * Math.pow(2, attempt)) + (Math.random() * 500);
        await new Promise(r => setTimeout(r, delay));
    }

    public async processRequest(payloadStr: string): Promise<string> {
        const telemetry = new TelemetryTracker();
        try {
            return await this.executeProcess(payloadStr, telemetry);
        } catch (e: any) {
            return this.handleError(e, telemetry);
        }
    }

    private async executeProcess(payloadStr: string, telemetry: TelemetryTracker): Promise<string> {
        this.validatePayloadSize(payloadStr);
        await this.initialize();
        const payload = this.parsePayload(payloadStr);
        telemetry.mark('init');
        
        const metadata = await this.getHardwareMetadata();
        Pcr0Verifier.verify(metadata.pcr0);
        await this.ensureWorker();
        telemetry.mark('attest');
        
        const receipt = await this._pep!.enforce(payload);
        telemetry.mark('pep');
        
        await this.signEscalatedReceipt(receipt);
        try {
            await SquadsRouter.routeIfEscalated(receipt);
        } catch (e: any) {
            console.warn(`[Aegis-12] SquadsRouter escalation failed (non-fatal): ${e.message}`);
        }
        await this._pep!.saveEvidence(receipt, 'batching');
        this.dispatchBackground(receipt);
        
        return this.formatSuccess(receipt, metadata, telemetry);
    }

    private async signEscalatedReceipt(receipt: AegisComplianceReceipt): Promise<void> {
        if (receipt.decision !== 'escalated' || !receipt.envelope) return;
        const envelopeHash = keccak256(Buffer.from(JsonUtils.stableStringify(receipt.envelope), 'utf8')).toString('hex');
        receipt.envelope.tee_signature = await this._signer!.sign(envelopeHash);
        await this._pep!.signReceipt(receipt);
    }

    private validatePayloadSize(payload: string): void {
        if (!payload || Buffer.byteLength(payload, 'utf8') > 128 * 1024) {
            throw new TerminalRefusalError('Payload exceeds 128KB.');
        }
    }

    private parsePayload(payload: string): PolicyEvaluationRequest {
        try { return JSON.parse(payload); } catch (e) { throw new TerminalRefusalError('Malformed JSON'); }
    }

    private formatSuccess(receipt: AegisComplianceReceipt, meta: any, tel: TelemetryTracker): string {
        return JsonUtils.stableStringify({ 
            status: receipt.decision, 
            receipt, 
            ledger_tx: "batching",
            enclaveDid: this._signer!.enclaveDid, 
            publicKeyHex: this._signer!.getPublicKeyHex(),
            attestation: meta.attestation, 
            pcr0: meta.pcr0, 
            telemetry: tel.getMetrics() 
        });
    }

    private dispatchBackground(receipt: AegisComplianceReceipt): void {
        this.anchorToLedger(receipt, receipt.decision).catch((err) => {
            console.error(`[Aegis-12] ⚠️ Background Anchor FAILED for ${receipt.receiptId}: ${err.message}`);
        });
        ZkProofGenerator.generate(receipt, receipt.authorizationNonce, this._pep, this._anchor).catch((err) => {
            console.error(`[Aegis-12] ⚠️ Background ZK FAILED for ${receipt.receiptId}: ${err.message}`);
        });
    }

    public async getHardwareMetadata() {
        await this.initialize();
        const attestation = await new TappdClient().getQuote(this._signer!.enclaveDid);
        const pcr0 = attestation ? (process.env.NODE_ENV !== 'production' && process.env.MOCK_PCR0 ? process.env.MOCK_PCR0 : "verified_via_quote") : "";
        return { attestation, pcr0 };
    }

    private async anchorToLedger(receipt: any, decision: 'approved' | 'denied' | 'escalated'): Promise<void> {
        const ledgerReceipt = await this._anchor!.anchorReceipt(receipt, decision, this._signer!.enclaveDid);
        if (decision === 'approved') await this._pep!.saveEvidence(receipt, ledgerReceipt.txSignature);
    }

    private async handleError(e: any, tel: TelemetryTracker): Promise<string> {
        this.anchorDeniedIfSafe(e);
        let errorMsg = e.message || 'Unknown error';
        const isTerminal = e instanceof TerminalRefusalError || e.name === 'TerminalRefusalError';
        
        console.error(`[Aegis-12] Internal Error:`, e);

        // SEC-05: Global Error Sanitization (VULN-002 / VULN-003)
        // Ensure we don't leak stack traces or raw unvalidated payload data
        if (!errorMsg.startsWith('Action denied by Aegis Enclave')) {
            errorMsg = `Action denied by Aegis Enclave: ${isTerminal ? errorMsg : 'Internal validation failure.'}`;
        }
        
        return JsonUtils.stableStringify({ status: "denied", error: errorMsg, enclaveDid: this._signer?.enclaveDid || "unknown", telemetry: tel.getMetrics() });
    }

    public async uploadVaultPolicy(tenantId: string, policyId: string, sensitiveData: any): Promise<void> {
        await this.initialize();
        if (!this._vaultStore) throw new Error("VaultStore not initialized");
        await this._vaultStore.savePolicy(tenantId, policyId, sensitiveData);
    }

    private anchorDeniedIfSafe(e: any): void {
        const isTerminal = e instanceof TerminalRefusalError || e.name === 'TerminalRefusalError';
        if (!isTerminal) {
            this.anchorToLedger({ actionId: `denied-${Date.now()}`, timestamp: new Date().toISOString() }, 'denied').catch(() => {});
        }
    }

    public async getEvidenceStatus(receiptId: string): Promise<string> {
        await this.initialize();
        const evidence = await this._pep?.getEvidenceByReceiptId(receiptId);
        return this.formatEvidence(evidence, receiptId);
    }

    private formatEvidence(evidence: any, receiptId: string): string {
        if (!evidence) return JSON.stringify({ status: "NOT_FOUND" });
        return JSON.stringify({ 
            status: evidence.ars_anchor ? "COMPLETED" : "pending", 
            receiptId, 
            ars_anchor: evidence.ars_anchor, 
            ledger_tx: evidence.ledger_tx 
        });
    }
}

export const enclave = AegisEnclave.getInstance();
export const phalaEntrypoint = (payload: string) => enclave.processRequest(payload);
export default phalaEntrypoint;
// Trigger CVM deployment: Vault Integration
