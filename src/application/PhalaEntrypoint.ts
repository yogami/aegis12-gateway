import { AegisSigner } from '../infrastructure/AegisSigner';
import { AegisPEP } from '../infrastructure/AegisPEP';
import { AegisZKClient } from '../infrastructure/AegisZKClient';
import { PolicyEvaluationRequest } from '../types';
import { SolanaAnchor } from '../infrastructure/SolanaAnchor';

declare global {
    var phala: { getQuote?: (did: string) => { quote: string; measurement: string } } | undefined;
}

export let signer: AegisSigner;
export let pep: AegisPEP;
export let anchor: SolanaAnchor;

/**
 * Initialization mutex: ensures only one init runs at a time.
 * All concurrent callers await the same Promise.
 */
let initPromise: Promise<void> | null = null;

export async function initializeHardware() {
    // Fast path: already initialized
    if (signer && pep && anchor) return;

    // Mutex: if init is in progress, await it instead of starting a new one
    if (initPromise) {
        await initPromise;
        return;
    }

    initPromise = doInitialize();
    try {
        await initPromise;
    } finally {
        initPromise = null;
    }
}

async function doInitialize() {
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        try {
            console.log(`[Aegis-12] Hardware Init: Attempting to connect to Tappd socket (Try ${attempts + 1}/${maxAttempts})...`);
            if (!signer) {
                signer = await AegisSigner.create();
                console.log(`[Aegis-12] Hardware Init: Signer established. DID: ${signer.enclaveDid}`);
            }

            if (!pep) {
                const rawTenants = process.env.AUTHORIZED_TENANTS || '{}';
                console.log(`[Aegis-12] Hardware Init: Parsing AUTHORIZED_TENANTS (length: ${rawTenants.length})`);
                try {
                    const tenants = JSON.parse(rawTenants);
                    
                    const { AegisLocalNonceRegistry } = await import('../infrastructure/NonceRegistry');
                    const { AegisLocalStateStore } = await import('../infrastructure/AegisLocalStateStore');
                    
                    const nonceReg = new AegisLocalNonceRegistry("/var/data/nonce_registry.json");
                    await nonceReg.initialize();
                    
                    const stateStore = new AegisLocalStateStore("/var/data/state_store.json");
                    await stateStore.initialize();

                    pep = new AegisPEP(signer, tenants, nonceReg, stateStore);
                    console.log(`[Aegis-12] Hardware Init: PEP initialized with ${Object.keys(tenants).length} tenants.`);
                } catch (pe) {
                    console.error(`[Aegis-12] Hardware Init: JSON Parse Error or DB Init Error:`, pe);
                    throw pe;
                }
            }

            if (!anchor) {
                console.log(`[Aegis-12] Hardware Init: Initializing SolanaAnchor for cluster: ${process.env.SOLANA_CLUSTER || 'devnet'}`);
                anchor = new SolanaAnchor(process.env.SOLANA_CLUSTER || 'devnet');
                console.log(`[Aegis-12] Hardware Init: SolanaAnchor established.`);
            }

            return;
        } catch (err: any) {
            attempts++;
            console.error(`[Aegis-12] Hardware Init Failure [Attempt ${attempts}]: ${err.message}`);
            console.error(err.stack);
            if (attempts >= maxAttempts) throw err;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

export async function getHardwareMetadata() {
    await initializeHardware();
    let attestation = "unknown";
    let pcr0 = "";
    try {
        const data = globalThis.phala?.getQuote?.(signer?.enclaveDid || "unknown");
        if (data) {
            attestation = data.quote;
            pcr0 = data.measurement;
        }
    } catch (e) {}
    return { attestation, pcr0 };
}

export default async function phalaEntrypoint(payloadStr: string): Promise<string> {
    try {
        await initializeHardware();
        
        if (!signer || !pep || !anchor) {
            throw new Error("[Aegis-12] CRITICAL_INIT_FAILURE: Hardware components not initialized after retries.");
        }

        const payload: PolicyEvaluationRequest = JSON.parse(payloadStr);
        const receipt = await pep.enforce(payload);
        
        const { attestation, pcr0 } = await getHardwareMetadata();
        if (!pcr0 || pcr0 === "") {
            throw new Error(`[TERMINAL REFUSAL] Genuine Enclave measurement (PCR0) is strictly required for this High-Veracity session. Boot aborted.`);
        }

        const zkProofData = await generateZkProof(receipt.receiptId, receipt.parametersHash);
        const solanaReceipt = await anchorToLedger(receipt, 'approved');

        return JSON.stringify({
            status: "approved",
            receipt,
            enclaveDid: signer?.enclaveDid || "unknown",
            attestation,
            pcr0: pcr0,
            ars_anchor: zkProofData.seal,
            zk_vkey: zkProofData.vkey,
            solana_tx: solanaReceipt?.txSignature,
            explorer_url: solanaReceipt?.explorerUrl
        });
    } catch (e: any) {
        return handleEntrypointError(e);
    }
}

async function generateZkProof(receiptId: string, policyHash: string): Promise<{ seal?: string, vkey?: string }> {
    const zkClient = new AegisZKClient();
    try {
        return await zkClient.generateProof({ receiptId, policyHash });
    } catch (err: any) {
        throw new Error(`[Aegis-12 Override]: ZK_PROVER_FAILURE. The RISC Zero prover failed to generate a cryptographic seal. Error: ${err.message}`);
    }
}

async function anchorToLedger(receipt: any, decision: 'approved' | 'denied'): Promise<{ txSignature?: string, explorerUrl?: string } | null> {
    if (!signer || !anchor) return null;
    try {
        const solanaReceipt = await anchor.anchorReceipt(receipt, decision, signer.enclaveDid);
        if (decision === 'approved') {
            await pep.saveEvidence(receipt, solanaReceipt.txSignature);
        }
        return solanaReceipt;
    } catch (e: any) {
        console.error(`[Aegis-12 Override]: SOLANA_ANCHOR_FAILURE. Failed to anchor ${decision}. Error: ${e.message}`);
        return null;
    }
}

async function handleEntrypointError(e: any): Promise<string> {
    const dummyReceipt = { actionId: `denied-${Date.now()}`, timestamp: new Date().toISOString() };
    const solanaReceipt = await anchorToLedger(dummyReceipt, 'denied');

    return JSON.stringify({
        status: "denied",
        error: e.message,
        enclaveDid: signer?.enclaveDid || "unknown",
        solana_tx: solanaReceipt?.txSignature,
        explorer_url: solanaReceipt?.explorerUrl
    });
}
