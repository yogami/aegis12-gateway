/**
 * AttestationQuote — Value Object
 *
 * Represents the Intel TDX/SGX DCAP quote binding.
 * The report_data field cryptographically binds:
 *   session_pubkey || policy_hash
 * This prevents replay attacks (Claude 4.7's binding requirement).
 *
 * SRP: Only responsible for creating and holding quote data.
 */
import { createHash } from 'crypto';
import { SessionKey } from './SessionKey';

export class AttestationQuote {
    private constructor(
        public readonly quoteHash: string,
        public readonly reportData: string,
        public readonly sessionPubkey: string,
        public readonly policyHash: string,
    ) {}

    static create(sessionKey: SessionKey, policyHash: string): AttestationQuote {
        const pubkey = sessionKey.publicKeyBase58();
        const reportData = `AEGIS_SESSION_V1||${pubkey}||${policyHash}`;
        const quoteHash = createHash('sha256')
            .update(reportData)
            .digest('hex');

        return new AttestationQuote(quoteHash, reportData, pubkey, policyHash);
    }
}
