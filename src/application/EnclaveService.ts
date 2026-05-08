/**
 * EnclaveService — Application Layer (Orchestrator)
 *
 * Orchestrates the "Asynchronous Attestation + Atomic Execution" flow:
 *   1. boot()   → Generate SessionKey → Create AttestationQuote → Submit to Oracle
 *   2. execute() → Evaluate Policy → Check Whitelist → Simulate → Execute Atomically
 *
 * Follows OCP: new oracle/executor implementations require zero changes here.
 * Follows DIP: depends on port interfaces, not concrete infrastructure.
 */
import { SessionKey } from '../domain/SessionKey';
import { AttestationQuote } from '../domain/AttestationQuote';
import { PolicyEvaluator, PolicyRuleset } from '../domain/PolicyEvaluator';
import { TradeIntent } from '../domain/TradeIntent';
import type { AttestationOracle } from '../ports/AttestationOracle';
import type { TransactionExecutor, AuditRegistry } from '../ports/TransactionExecutor';

export class FiduciaryEscalationError extends Error {
    public readonly intentEnvelope: any;
    
    constructor(message: string, intent: TradeIntent) {
        super(message);
        this.name = 'FiduciaryEscalationError';
        this.intentEnvelope = {
            domain_separator: 'AEGIS12_ESCALATE_V1',
            intent_details: {
                destination: intent.destination,
                amountSol: intent.amountSol
            },
            status: 'WAITING_FOR_CO_SIGNER'
        };
    }
}

export class EnclaveService {
    private sessionKey: SessionKey | null = null;
    private quote: AttestationQuote | null = null;
    private attested = false;
    private readonly evaluator: PolicyEvaluator;

    constructor(
        ruleset: PolicyRuleset,
        private readonly oracle: AttestationOracle,
        private readonly executor: TransactionExecutor,
        private readonly registry?: AuditRegistry
    ) {
        this.evaluator = new PolicyEvaluator(ruleset);
    }

    async boot(): Promise<void> {
        this.sessionKey = SessionKey.loadOrGenerate();
        const policyHash = this.evaluator.policyHash();
        this.quote = AttestationQuote.create(this.sessionKey, policyHash);
        this.attested = await this.oracle.submitQuote(this.quote);
    }

    isAttested(): boolean {
        return this.attested;
    }

    sessionPublicKey(): string | null {
        return this.sessionKey?.publicKeyBase58() ?? null;
    }

    async execute(intent: TradeIntent): Promise<string> {
        this.assertAttested();
        
        try {
            this.assertPolicyApproved(intent);
            await this.assertWhitelisted();
            
            // ITEM 3.2: SEMANTIC VALIDATION (Simulation)
            // Before signing, we simulate the transaction to ensure it doesn't 
            // produce unexpected state changes (e.g. permission escapes).
            console.log(`[Enclave] Pre-flight simulation for intent: ${intent.amountSol} SOL`);
            const sim = await this.executor.simulate(this.sessionKey!, intent, this.quote!);
            if (!sim.success) {
                const reason = `Simulation failed: ${sim.error}`;
                this.logAudit(intent, { approved: false, escalated: false, reason });
                throw new Error(`POLICY DENIED: ${reason}`);
            }

            const txSig = await this.executor.execute(this.sessionKey!, intent, this.quote!);
            this.logAudit(intent, { approved: true, escalated: false, reason: 'Execution successful' });
            return txSig;
        } catch (error: any) {
            if (error instanceof FiduciaryEscalationError) {
                this.logAudit(intent, { approved: false, escalated: true, reason: error.message });
            } else {
                this.logAudit(intent, { approved: false, escalated: false, reason: error.message });
            }
            throw error;
        }
    }

    private assertAttested(): void {
        if (!this.attested || !this.sessionKey || !this.quote) {
            throw new Error('Enclave is not attested. Call boot() first.');
        }
    }

    private assertPolicyApproved(intent: TradeIntent): void {
        const result = this.evaluator.evaluate(intent);
        if (result.escalated) {
            throw new FiduciaryEscalationError(`POLICY ESCALATED: ${result.reason}`, intent);
        }
        if (!result.approved) {
            throw new Error(`POLICY DENIED: ${result.reason}`);
        }
    }

    private async assertWhitelisted(): Promise<void> {
        const pubkey = this.sessionKey!.publicKeyBase58();
        const whitelisted = await this.oracle.isWhitelisted(pubkey);
        if (!whitelisted) {
            throw new Error('Session key has been revoked by the oracle.');
        }
    }

    private logAudit(intent: TradeIntent, decision: { approved: boolean; escalated: boolean; reason: string }) {
        if (this.registry) {
            this.registry.logDecision(intent, decision).catch(err => {
                console.warn(`[Enclave] ⚠️ Failed to log audit: ${err.message}`);
            });
        }
    }
}
