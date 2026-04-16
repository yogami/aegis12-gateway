import { AegisSigner } from '../infrastructure/AegisSigner';
import { AegisPEP } from '../infrastructure/AegisPEP';
import { PolicyEvaluationRequest } from '../types';

export const signer = new AegisSigner();
export const pep = new AegisPEP(signer, JSON.parse(process.env.AUTHORIZED_TENANTS || '{}'));

export default async function phalaEntrypoint(payloadStr: string): Promise<string> {
    try {
        const payload: PolicyEvaluationRequest = JSON.parse(payloadStr);
        const receipt = await pep.enforce(payload);
        
        let attestation = "not_available_in_mock";
        try {
            // @ts-ignore
            const data = globalThis.phala?.getQuote?.(signer.enclaveDid);
            if (data) attestation = data.quote;
        } catch (e) {}

        return JSON.stringify({
            status: "approved",
            receipt,
            enclaveDid: signer.enclaveDid,
            attestation
        });
    } catch (e: any) {
        return JSON.stringify({
            status: "denied",
            error: e.message,
            enclaveDid: signer.enclaveDid
        });
    }
}
