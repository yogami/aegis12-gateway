import { AttestationOracle } from '../ports/AttestationOracle';
import { AttestationQuote } from '../domain/AttestationQuote';
import { TappdClient } from './TappdClient';

/**
 * PhalaAttestationOracle
 * 
 * Uses the real Phala TEE Hardware (dStack CVM) to obtain cryptographic
 * attestations and whitelists keys.
 */
export class PhalaAttestationOracle implements AttestationOracle {
    private tappd = new TappdClient();
    private whitelistedKeys = new Set<string>();

    async submitQuote(quote: AttestationQuote): Promise<boolean> {
        // Submit the quote to the on-chain registry (mocked latency for now)
        await new Promise(resolve => setTimeout(resolve, 800));
        this.whitelistedKeys.add(quote.sessionPubkey);
        return true;
    }

    async isWhitelisted(sessionPubkey: string): Promise<boolean> {
        return this.whitelistedKeys.has(sessionPubkey);
    }

    // New method added to expose the raw hardware quote
    async getRawQuote(data: string): Promise<string> {
        return await this.tappd.getQuote(data);
    }
}
