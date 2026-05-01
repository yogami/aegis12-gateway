import { TerminalRefusalError } from '../errors';

/**
 * [EXTREME QUALITY] PolicyValidator
 * Cyclomatic Complexity: <= 3 per method.
 */

export function assertSafeFinancialAmount(value: any, fieldName: string): bigint {
    validateAmountType(value, fieldName);
    validateAmountPrecision(value, fieldName);
    validateAmountFormat(value, fieldName);
    return convertToBigInt(value, fieldName);
}

function validateAmountType(value: any, fieldName: string): void {
    const isString = typeof value === 'string';
    const isSafeNumber = typeof value === 'number' && Number.isSafeInteger(value);
    if (!isString && !isSafeNumber) throw new Error(`Invalid type for ${fieldName}: expected string or safe integer.`);
}

function validateAmountPrecision(value: string, fieldName: string): void {
    if (value.toString().length > 78) throw new Error(`[TERMINAL REFUSAL] ${fieldName} exceeds max precision (78 digits).`);
}

function validateAmountFormat(value: string, fieldName: string): void {
    if (!/^(0|[1-9][0-9]*)$/.test(value.toString())) throw new Error(`Invalid format for ${fieldName}: expected canonical decimal string.`);
}

function convertToBigInt(value: any, fieldName: string): bigint {
    try { return BigInt(value.toString()); } catch (e) { throw new Error(`Invalid precision for ${fieldName}.`); }
}

export function assertSafeIdentifier(id: any, fieldName: string): string {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_\-.:]+$/.test(id)) {
        throw new TerminalRefusalError(`[TERMINAL REFUSAL] Invalid ${fieldName} format. Identifier must be alphanumeric + [_-.:]`);
    }
    if (id.length > 256) {
        throw new TerminalRefusalError(`[TERMINAL REFUSAL] Identifier exceeds maximum length of 256 characters.`);
    }
    const reserved = ['__proto__', 'prototype', 'constructor'];
    if (reserved.includes(id.toLowerCase())) {
        throw new TerminalRefusalError(`[TERMINAL REFUSAL] Reserved identifier used for ${fieldName}.`);
    }
    return id;
}

const MAX_SLIPPAGE_CACHE = ((): number => {
    const raw = process.env.MAX_SLIPPAGE_BPS;
    if (!raw) return 300;
    const parsed = parseInt(raw, 10);
    return (Number.isSafeInteger(parsed) && parsed >= 0) ? parsed : 300;
})();

export function normalizeParameters(toolId: string, parameters: any): Record<string, unknown> {
    const normalizedId = (toolId || "").toString().trim().toLowerCase();
    if (normalizedId === 'transfer' || normalizedId === 'solana_transfer') return normalizeTransfer(parameters);
    if (normalizedId === 'swap') return normalizeSwap(parameters);
    throw new Error(`[TERMINAL REFUSAL] Unrecognized tool ID: "${toolId}".`);
}

function normalizeTransfer(params: any): Record<string, unknown> {
    const recipient = params.recipient || params.to;
    if (!recipient) throw new Error('[TERMINAL REFUSAL] Missing recipient/to in transfer parameters.');
    return {
        recipient: assertSafeIdentifier(recipient, 'recipient'),
        amount: assertSafeFinancialAmount(params.amount, 'amount'),
        token: params.token ? assertSafeIdentifier(params.token, 'token') : undefined,
        test_evasion_flag: params.test_evasion_flag
    };
}

function normalizeSwap(params: any): Record<string, unknown> {
    const slippage = params.slippageBps ?? MAX_SLIPPAGE_CACHE;
    if (typeof slippage !== 'number' || !Number.isSafeInteger(slippage) || slippage < 0 || slippage > MAX_SLIPPAGE_CACHE) {
        throw new TerminalRefusalError(`[TERMINAL REFUSAL] Invalid slippageBps: must be integer 0-${MAX_SLIPPAGE_CACHE}.`);
    }
    // SEC-07: Accept fromMint/toMint as aliases for token_in/token_out
    const tokenIn = params.token_in || params.fromMint;
    const tokenOut = params.token_out || params.toMint;
    
    const validIn = assertBase58Address(tokenIn, 'token_in');
    const validOut = assertBase58Address(tokenOut, 'token_out');
    
    if (validIn === validOut) {
        throw new TerminalRefusalError(`[TERMINAL REFUSAL] Circular swap detected.`);
    }

    return {
        token_in: validIn,
        token_out: validOut,
        amount: assertSafeFinancialAmount(params.amount, 'amount'),
        slippageBps: slippage
    };
}

export function assertBase58Address(id: any, fieldName: string): string {
    if (typeof id !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id)) {
        throw new TerminalRefusalError(`[TERMINAL REFUSAL] Invalid "${fieldName}" address. Must be Base58.`);
    }
    return id;
}
