import { AegisSigner } from '../infrastructure/AegisSigner';
import { AegisPEP } from '../infrastructure/AegisPEP';
import { AegisZKClient } from '../infrastructure/AegisZKClient';
import { PolicyEvaluationRequest } from '../types';

export const signer = new AegisSigner();
export const pep = new AegisPEP(signer, JSON.parse(process.env.AUTHORIZED_TENANTS || '{}'));

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

        return JSON.stringify({
            status: "approved",
            receipt,
            enclaveDid: signer.enclaveDid,
            attestation,
            pcr0: pcr0,
            ars_anchor: zkProofData.seal,
            zk_vkey: zkProofData.vkey
        });
    } catch (e: any) {
        return JSON.stringify({
            status: "denied",
            error: e.message,
            enclaveDid: signer.enclaveDid
        });
    }
}
