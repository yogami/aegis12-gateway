import { AegisSigner } from '../infrastructure/AegisSigner';
import { AegisPEP } from '../infrastructure/AegisPEP';
import { AegisZKClient } from '../infrastructure/AegisZKClient';
import { PolicyEvaluationRequest } from '../types';
import { SolanaAnchor } from '../infrastructure/SolanaAnchor';

export const signer = new AegisSigner();
export const pep = new AegisPEP(signer, JSON.parse(process.env.AUTHORIZED_TENANTS || '{}'));
export const anchor = new SolanaAnchor('devnet');

export default async function phalaEntrypoint(payloadStr: string): Promise<string> {
    try {
        const payload: PolicyEvaluationRequest = JSON.parse(payloadStr);
        const receipt = await pep.enforce(payload);
        
        let attestation = "not_available_in_mock";
        let pcr0 = process.env.ENCLAVE_PCR0_MOCK || "0000000000000000000000000000000000000000000000000000000000000000";
        try {
            // @ts-ignore
            const data = globalThis.phala?.getQuote?.(signer.enclaveDid);
            if (data) {
                attestation = data.quote;
                pcr0 = data.measurement || pcr0;
            }
        } catch (e) {}

        if (!pcr0) {
            throw new Error(`[TERMINAL REFUSAL] Missing enclave measurement (PCR0). Boot aborted.`);
        }

        const zkClient = new AegisZKClient();
        let zkProofData: any = {};
        try {
            zkProofData = await zkClient.generateProof({ receiptId: receipt.receiptId, policyHash: receipt.parametersHash });
        } catch (err: any) {
            throw new Error(`[Aegis-12 Override]: ZK_PROVER_FAILURE. The RISC Zero prover failed to generate a cryptographic seal. Error: ${err.message}`);
        }

        let solanaReceipt = null;
        try {
            solanaReceipt = await anchor.anchorReceipt(receipt, 'approved', signer.enclaveDid);
        } catch (e: any) {
            console.error(`[Aegis-12 Override]: SOLANA_ANCHOR_FAILURE. Failed to anchor receipt. Error: ${e.message}`);
        }

        return JSON.stringify({
            status: "approved",
            receipt,
            enclaveDid: signer.enclaveDid,
            attestation,
            pcr0: pcr0,
            ars_anchor: zkProofData.seal,
            zk_vkey: zkProofData.vkey,
            solana_tx: solanaReceipt?.txSignature,
            explorer_url: solanaReceipt?.explorerUrl
        });
    } catch (e: any) {
        let solanaReceipt = null;
        try {
            // Anchor the denial to create an immutable record of the blocked transaction
            const dummyReceipt = { actionId: `denied-${Date.now()}`, timestamp: new Date().toISOString() };
            solanaReceipt = await anchor.anchorReceipt(dummyReceipt, 'denied', signer.enclaveDid);
        } catch (err: any) {
             console.error(`[Aegis-12 Override]: SOLANA_ANCHOR_FAILURE. Failed to anchor denial. Error: ${err.message}`);
        }

        return JSON.stringify({
            status: "denied",
            error: e.message,
            enclaveDid: signer.enclaveDid,
            solana_tx: solanaReceipt?.txSignature,
            explorer_url: solanaReceipt?.explorerUrl
        });
    }
}
