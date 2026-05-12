/**
 * AttestationOracle — Port (Secondary Interface)
 *
 * Defines the contract for submitting DCAP quotes and checking
 * session key whitelist status. Infrastructure adapters implement this.
 *
 * In production: SwitchboardAttestationOracle
 * In tests/hackathon: MockAttestationOracle
 */
import { AttestationQuote } from '../domain/AttestationQuote';

export interface AttestationOracle {
    submitQuote(quote: AttestationQuote): Promise<boolean>;
    isWhitelisted(sessionPubkey: string): Promise<boolean>;
}
