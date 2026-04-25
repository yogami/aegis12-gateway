export function assertSafeFinancialAmount(value: unknown, fieldName: string): bigint {
    try {
        const bigVal = BigInt(value as any);
        if (bigVal < 0n) {
            throw new Error(`Manipulation detected on ${fieldName}: Negative values are mathematically unsafe for this field.`);
        }
        return bigVal;
    } catch (e: any) {
        if (e.message.includes("Negative values")) throw e;
        throw new Error(`Invalid type or precision loss for ${fieldName}: expected valid BigInt string/number, got ${typeof value}`);
    }
}

function isValidSolanaAddress(addr: string): boolean {
    return typeof addr === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

// --- CLAUDE 4.6 HARDENING: IMMUTABLE SECURITY PROPERTIES CACHE ---
const APPROVED_MINTS_CACHE = ((): ReadonlySet<string> => {
    const raw = process.env.APPROVED_SWAP_MINTS;
    const defaults = [
        "So11111111111111111111111111111111111111112", // Native SOL
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"  // USDT
    ];
    const set = new Set(raw ? raw.split(',').map(s => s.trim()) : defaults);
    return Object.freeze(set);
})();

const MAX_SLIPPAGE_CACHE = ((): number => {
    if (process.env.MAX_SLIPPAGE_BPS) return parseInt(process.env.MAX_SLIPPAGE_BPS, 10);
    return 300; // 3% default
})();

export function normalizeParameters(toolId: string, parameters: Record<string, unknown>): Record<string, unknown> {
    if (toolId === 'solana_transfer') {
        const to = parameters.to as string;
        if (!isValidSolanaAddress(to)) {
            throw new Error(`Invalid 'to' address for solana_transfer. Must be a valid Base58 public key.`);
        }
        if (parameters.token !== 'SOL') {
            throw new Error(`Schema Sanitization Failed: Missing or invalid 'token' field preventing asset substitution`);
        }
        return Object.assign(Object.create(null), {
            to: parameters.to,
            amount: assertSafeFinancialAmount(parameters.amount, 'amount'),
            token: 'SOL'
        });
    } else if (toolId === 'swap') {
        if (!isValidSolanaAddress(parameters.fromMint as string)) {
            throw new Error(`Invalid 'fromMint' address. Must be Base58 public key.`);
        }
        if (!isValidSolanaAddress(parameters.toMint as string)) {
            throw new Error(`Invalid 'toMint' address. Must be Base58 public key.`);
        }
        if (parameters.fromMint === parameters.toMint) {
            throw new Error(`Circular swap detected. fromMint and toMint are identical.`);
        }
        // NEW-VULN-005: Environment-configurable Mints subset to protect against honeypots
        if (!APPROVED_MINTS_CACHE.has(parameters.fromMint as string) || !APPROVED_MINTS_CACHE.has(parameters.toMint as string)) {
            throw new Error(`[TERMINAL REFUSAL] swap token mint is not approved by the secure TEE allowlist properties.`);
        }
        const slippage = assertSafeFinancialAmount(parameters.slippageBps, 'slippageBps');
        if (slippage > BigInt(MAX_SLIPPAGE_CACHE)) {
            throw new Error(`[TERMINAL REFUSAL] slippageBps (${slippage}) exceeds mathematically safe MEV bounds of ${MAX_SLIPPAGE_CACHE}.`);
        }
        return Object.assign(Object.create(null), {
            fromMint: parameters.fromMint,
            toMint: parameters.toMint,
            amount: assertSafeFinancialAmount(parameters.amount, 'amount'),
            slippageBps: slippage
        });
    } else if (toolId === 'insurance_claim') {
        const { IncaInsurancePolicy } = require('./IncaInsurancePolicy');
        return IncaInsurancePolicy.validateClaim(parameters);
    }

    throw new Error(`[TERMINAL REFUSAL] Unrecognized tool execution request.`);
}
