import keccak256 from 'keccak256';

/**
 * [WORLD CLASS QUALITY] Unified JSON Utilities
 * Prevents recursive DoS and ensures stable hashing domains.
 */
export class JsonUtils {
    /**
     * Depth-guarded stable stringifier (P1-02/CQ-02)
     */
    public static stableStringify(obj: any, depth = 0): string {
        if (depth > 16) throw new Error('[TERMINAL REFUSAL] JSON depth limit exceeded (Parser Bomb Defense).');
        if (obj === null || typeof obj !== 'object') {
            return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        }
        if (Array.isArray(obj)) {
            return `[${obj.map(o => JsonUtils.stableStringify(o, depth + 1)).join(',')}]`;
        }
        const keys = Object.keys(obj).sort();
        return `{${keys.map(k => `${JSON.stringify(k)}:${JsonUtils.stableStringify(obj[k], depth + 1)}`).join(',')}}`;
    }

    /**
     * Unified Keccak-256 Hashing for Receipts (P0-03)
     */
    public static computeReceiptHash(receipt: any): string {
        const { signature, solana_tx, ars_anchor, zk_vkey, batchProof, ...signable } = receipt;
        return keccak256(Buffer.from(JsonUtils.stableStringify(signable), 'utf8')).toString('hex');
    }

    /**
     * Safe JSON Parser with Structural Guards (P0-01)
     */
    public static safeParse(raw: string, domain: string): any {
        try {
            const parsed = JSON.parse(raw);
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error(`Invalid JSON structure for ${domain}`);
            }
            return parsed;
        } catch (e: any) {
            const { TerminalRefusalError } = require('../errors');
            throw new TerminalRefusalError(`[TERMINAL REFUSAL] Malformed JSON in ${domain}: ${e.message}`);
        }
    }
}
