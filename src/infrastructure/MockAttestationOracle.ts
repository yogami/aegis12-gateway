import { AttestationOracle } from '../ports/AttestationOracle';
import { AttestationQuote } from '../domain/AttestationQuote';

/**
 * MockAttestationOracle
 * 
 * Simulates the Asynchronous Attestation flow for the hackathon MVP.
 * In production, this interacts with Switchboard V3 or a custom Anchor program
 * to submit the quote and read the resulting PDA state.
 */
export class MockAttestationOracle implements AttestationOracle {
    private whitelistedKeys = new Set<string>();

    async submitQuote(quote: AttestationQuote): Promise<boolean> {
        console.log(`[Switchboard Oracle] Received 4.5KB Intel DCAP Quote from Enclave.`);
        console.log(`[Switchboard Oracle] Validating report_data cryptographic binding...`);
        
        // Simulate latency for the asynchronous network consensus
        await new Promise(resolve => setTimeout(resolve, 800));

        // Whitelist the session key bound in the quote
        this.whitelistedKeys.add(quote.sessionPubkey);
        
        console.log(`[Switchboard Oracle] ✅ DCAP Verified. Session Key ${quote.sessionPubkey.substring(0, 8)}... is now ON-CHAIN WHITELISTED.\n`);
        return true;
    }

    async isWhitelisted(sessionPubkey: string): Promise<boolean> {
        return this.whitelistedKeys.has(sessionPubkey);
    }
}
