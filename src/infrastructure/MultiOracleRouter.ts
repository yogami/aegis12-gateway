import { AttestationOracle } from '../ports/AttestationOracle';
import { AttestationQuote } from '../domain/AttestationQuote';

export class MultiOracleRouter implements AttestationOracle {
    constructor(private readonly oracles: AttestationOracle[]) {
        if (oracles.length === 0) {
            throw new Error('MultiOracleRouter requires at least one oracle.');
        }
    }

    async submitQuote(quote: AttestationQuote): Promise<boolean> {
        console.log(`[MultiOracleRouter] Attempting to submit quote across ${this.oracles.length} oracles...`);
        
        for (let i = 0; i < this.oracles.length; i++) {
            const oracleName = this.oracles[i].constructor.name;
            try {
                const success = await this.oracles[i].submitQuote(quote);
                if (success) {
                    console.log(`[MultiOracleRouter] ✅ Successfully submitted quote via ${oracleName}`);
                    return true;
                }
                console.warn(`[MultiOracleRouter] ⚠️ ${oracleName} returned false. Falling back to next oracle...`);
            } catch (error: any) {
                console.warn(`[MultiOracleRouter] ⚠️ Oracle ${oracleName} failed: ${error.message}. Falling back to next oracle...`);
            }
        }
        
        console.error('[MultiOracleRouter] ❌ All oracles failed to submit the quote.');
        return false;
    }

    async isWhitelisted(pubkeyBase58: string): Promise<boolean> {
        console.log(`[MultiOracleRouter] Checking whitelist status across ${this.oracles.length} oracles...`);
        
        for (let i = 0; i < this.oracles.length; i++) {
            const oracleName = this.oracles[i].constructor.name;
            try {
                const isWhitelisted = await this.oracles[i].isWhitelisted(pubkeyBase58);
                if (isWhitelisted) {
                    console.log(`[MultiOracleRouter] ✅ Whitelist confirmed by ${oracleName}`);
                    return true;
                }
                console.warn(`[MultiOracleRouter] ⚠️ ${oracleName} reports UNVERIFIED. Falling back to next oracle...`);
            } catch (error: any) {
                console.warn(`[MultiOracleRouter] ⚠️ Oracle ${oracleName} failed: ${error.message}. Falling back to next oracle...`);
            }
        }
        
        console.error('[MultiOracleRouter] ❌ Enclave is unverified across all oracles in the squad.');
        return false;
    }
}
