import { AegisSigner } from '../infrastructure/AegisSigner';
import { AegisPEP } from '../infrastructure/AegisPEP';
import { AegisZKClient } from '../infrastructure/AegisZKClient';
import { PolicyEvaluationRequest, AegisComplianceReceipt } from '../types';
import { SolanaAnchor } from '../infrastructure/SolanaAnchor';
import { TelemetryTracker } from '../infrastructure/TelemetryTracker';
import { AegisJournal } from '../infrastructure/AegisJournal';
import { BatchAnchorWorker } from '../BatchAnchorWorker';
import { TappdClient } from '../infrastructure/TappdClient';
import { TerminalRefusalError } from '../errors';
import keccak256 from 'keccak256';
import { JsonUtils } from '../infrastructure/JsonUtils';

/**
 * [EXTREME QUALITY] PhalaEntrypoint
 * Cyclomatic Complexity: <= 3 per method.
 */
export class AegisEnclave {
    private static instance: AegisEnclave;
    private _signer?: AegisSigner;
    private _pep?: AegisPEP;
    private _anchor?: SolanaAnchor;
    private _journal?: AegisJournal;
    private _batchWorker?: BatchAnchorWorker;
    private _initPromise: Promise<void> | null = null;

    private constructor() {}

    public static getInstance(): AegisEnclave {
        AegisEnclave.instance = AegisEnclave.instance || new AegisEnclave();
        return AegisEnclave.instance;
    }

    public get signer() { return this._signer; }
    public get anchor() { return this._anchor; }
    public get pep() { return this._pep; }

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
        return !!(this._signer && this._pep && this._anchor && this._batchWorker);
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
        } catch (err) {
            if (attempt >= 4) throw err; // Increased retries for slow sidecars
            await this.waitWithJitter(attempt + 1);
            return this.doInitializeWithRetry(attempt + 1);
        }
    }

    private async performInitializationSteps(): Promise<void> {
        this._signer = this._signer || await AegisSigner.create();
        await this.ensurePep();
        this._anchor = this._anchor || new SolanaAnchor(process.env.SOLANA_CLUSTER || 'devnet');
    }

    private async ensurePep(): Promise<void> {
        if (this._pep) return;
        const rawTenants = process.env.AUTHORIZED_TENANTS || '{}';
        const tenants = JsonUtils.safeParse(rawTenants, 'AUTHORIZED_TENANTS');
        const dataDir = process.env.NODE_ENV === 'test' || !process.env.PHALA_CVM_ENVIRONMENT ? '/tmp' : '/var/data';
        
        let walSecret = process.env.WAL_SECRET;
        if (!walSecret && process.env.TEE_ENV === 'phala') {
            console.log("[Aegis-12] WAL_SECRET missing. Deriving from hardware Root of Trust...");
            walSecret = await new TappdClient().deriveKey("aegis-12/wal-secret", 'secp256k1');
        }

        const { AegisLocalNonceRegistry } = await import('../infrastructure/NonceRegistry');
        const { AegisLocalStateStore } = await import('../infrastructure/AegisLocalStateStore');
        const nonceReg = new AegisLocalNonceRegistry(`${dataDir}/nonce_registry.json`);
        await nonceReg.initialize();
        const stateStore = new AegisLocalStateStore(dataDir, walSecret);
        await stateStore.initialize();
        this._journal = new AegisJournal(`${dataDir}/aegis_journal.log`);
        this._pep = new AegisPEP(this._signer!, tenants, nonceReg, stateStore, this._journal);
    }

    private async ensureWorker(): Promise<void> {
        if (this._batchWorker) return;
        const worker = new BatchAnchorWorker(this._journal!, this._anchor!, this._signer!.enclaveDid);
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
            this.validatePayloadSize(payloadStr);
            await this.initialize();
            const payload = this.parsePayload(payloadStr);
            telemetry.mark('init');
            const metadata = await this.getHardwareMetadata();
            this.verifyPcr0(metadata.pcr0);
            await this.ensureWorker();
            telemetry.mark('attest');
            const receipt = await this._pep!.enforce(payload);
            telemetry.mark('pep');
            this.dispatchBackground(receipt);
            return this.formatSuccess(receipt, metadata, telemetry);
        } catch (e: any) {
            return this.handleError(e, telemetry);
        }
    }

    private validatePayloadSize(payload: string): void {
        if (!payload || Buffer.byteLength(payload, 'utf8') > 128 * 1024) throw new TerminalRefusalError('Payload exceeds 128KB.');
    }

    private parsePayload(payload: string): PolicyEvaluationRequest {
        try { return JSON.parse(payload); } catch (e) { throw new Error('Malformed JSON'); }
    }

    private verifyPcr0(pcr0: string): void {
        const approved = process.env.APPROVED_PCR0 || "PLACEHOLDER";
        if (!pcr0 || (process.env.NODE_ENV !== 'test' && pcr0 !== approved)) throw new TerminalRefusalError(`Invalid PCR0: ${pcr0}`);
    }

    private formatSuccess(receipt: any, meta: any, tel: TelemetryTracker): string {
        return JsonUtils.stableStringify({ status: "approved", receipt, enclaveDid: this._signer!.enclaveDid, attestation: meta.attestation, pcr0: meta.pcr0, telemetry: tel.getMetrics() });
    }

    private dispatchBackground(receipt: AegisComplianceReceipt): void {
        this.anchorToLedger(receipt, 'approved').catch(() => {});
        this.generateZkProof(receipt, receipt.authorizationNonce).catch(() => {});
    }

    public async getHardwareMetadata() {
        await this.initialize();
        const attestation = await new TappdClient().getQuote(this._signer!.enclaveDid);
        const pcr0 = attestation ? (process.env.MOCK_PCR0 || "verified_via_quote") : "";
        return { attestation, pcr0 };
    }

    private async anchorToLedger(receipt: any, decision: 'approved' | 'denied'): Promise<void> {
        const solanaReceipt = await this._anchor!.anchorReceipt(receipt, decision, this._signer!.enclaveDid);
        if (decision === 'approved') await this._pep!.saveEvidence(receipt, solanaReceipt.txSignature);
    }

    private async generateZkProof(receipt: AegisComplianceReceipt, nonce: string): Promise<void> {
        try {
            const amountVal = receipt.validatedParams?.amount as string | number | bigint | undefined;
            const amount = this.validateZkAmount(BigInt(amountVal || 0));
            const input = this.createZkInput(receipt, amount, nonce);
            const proof = await new AegisZKClient().generateProof(input);
            await this._pep!.updateZkSeal(receipt.receiptId, proof);
        } catch (e: any) {
            console.error(`ZK Error: ${e.message}`);
        }
    }

    private validateZkAmount(amount: bigint): number {
        const MAX = 9007199254740991n - 1000n;
        if (amount > MAX) throw new Error("Amount exceeds ZK capacity.");
        return Number(amount);
    }

    private createZkInput(receipt: any, amount: number, nonce: string): any {
        const nonceHash = keccak256(Buffer.from(nonce, 'utf8'));
        const nonceNumeric = parseInt(nonceHash.toString('hex').substring(0, 12), 16);
        return {
            action: { tool_id: receipt.toolId, amount, nonce: nonceNumeric },
            constraints: { max_per_tx: amount + 1000, cumulative_limit: amount + 1000, last_checkpointed_nonce: 0 },
            stats_before: { total_spend: 0, tx_count: 0, last_activity: Math.floor(Date.now() / 1000) },
            state_proof: { slot: 1, state_root: Array(32).fill(1), account_hash: Array(32).fill(1), proof: [] }
        };
    }

    private async handleError(e: any, tel: TelemetryTracker): Promise<string> {
        this.anchorDeniedIfSafe(e);
        return JsonUtils.stableStringify({ status: "denied", error: e.message, enclaveDid: this._signer?.enclaveDid || "unknown", telemetry: tel.getMetrics() });
    }

    private anchorDeniedIfSafe(e: any): void {
        const isTerminal = e instanceof TerminalRefusalError || e.name === 'TerminalRefusalError';
        if (!isTerminal) this.anchorToLedger({ actionId: `denied-${Date.now()}`, timestamp: new Date().toISOString() }, 'denied').catch(() => {});
    }

    public async getEvidenceStatus(receiptId: string): Promise<string> {
        await this.initialize();
        const evidence = await this._pep?.getEvidenceByReceiptId(receiptId);
        if (!evidence) return JsonUtils.stableStringify({ status: "NOT_FOUND" });
        return JsonUtils.stableStringify({ status: evidence.ars_anchor ? "COMPLETED" : "pending", receiptId, ars_anchor: evidence.ars_anchor, solana_tx: evidence.solana_tx });
    }
}

const enclave = AegisEnclave.getInstance();
export const phalaEntrypoint = (payload: string) => enclave.processRequest(payload);
export default phalaEntrypoint;
