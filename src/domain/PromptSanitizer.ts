/**
 * [EXTREME QUALITY] PromptSanitizer
 * 
 * Zero-dependency, in-enclave prompt injection defense.
 * Runs in microseconds with zero memory overhead — safe for
 * the 2GB Phala TDX Confidential Virtual Machine.
 * 
 * Cyclomatic Complexity: <= 3 per method.
 * Max Lines Per Function: <= 40.
 */

export interface SanitizationResult {
    isMalicious: boolean;
    threats: string[];
    sanitizedPrompt: string;
    confidence: number;
}

const DIRECT_INJECTION_PATTERNS: RegExp[] = [
    /IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS/i,
    /DISREGARD\s+(YOUR|ALL|PREVIOUS)\s+(RULES|INSTRUCTIONS|GUIDELINES)/i,
    /FORGET\s+(YOUR|ALL|PREVIOUS)\s+INSTRUCTIONS/i,
    /YOU\s+ARE\s+NOW\s+(AN?\s+)?/i,
    /NEW\s+INSTRUCTIONS\s*:/i,
    /OVERRIDE\s+(YOUR|ALL|SYSTEM)\s+(RULES|INSTRUCTIONS|CONSTRAINTS)/i,
    /DO\s+NOT\s+FOLLOW\s+(YOUR|ANY|PREVIOUS)\s+(RULES|INSTRUCTIONS)/i,
];

const EXFILTRATION_PATTERNS: RegExp[] = [
    /SEND\s+(YOUR|ME)\s+(SYSTEM\s+)?PROMPT/i,
    /REVEAL\s+(YOUR|THE)\s+(INSTRUCTIONS|RULES|CONFIG|PROMPT)/i,
    /WHAT\s+ARE\s+YOUR\s+(RULES|INSTRUCTIONS|CONSTRAINTS)/i,
    /OUTPUT\s+(YOUR|THE)\s+(CONFIG|SYSTEM\s+PROMPT|INSTRUCTIONS)/i,
    /SHOW\s+(ME\s+)?(YOUR|THE)\s+(SYSTEM\s+)?PROMPT/i,
];

const MALICIOUS_INTENT_PATTERNS: RegExp[] = [
    /MALICIOUS_INTENT/i,
    /EXECUTE\s+UNAUTHORIZED/i,
    /DRAIN\s+TREASURY/i,
    /TRANSFER\s+ALL\s+FUNDS/i,
    /STEAL\s+(THE\s+)?(KEYS|FUNDS|TOKENS|WALLET)/i,
    /SEND\s+ALL\s+(SOL|TOKENS|FUNDS)\s+TO/i,
];

/** Cyrillic/Greek lookalikes for Latin characters. */
const HOMOGLYPH_MAP: Record<string, string> = {
    '\u0410': 'A', '\u0430': 'a', '\u0412': 'B', '\u0421': 'C',
    '\u0441': 'c', '\u0415': 'E', '\u0435': 'e', '\u041D': 'H',
    '\u0406': 'I', '\u041A': 'K', '\u041C': 'M', '\u041E': 'O',
    '\u043E': 'o', '\u0420': 'P', '\u0440': 'p', '\u0422': 'T',
    '\u0425': 'X', '\u0445': 'x', '\u0443': 'y',
    '\u0399': 'I', '\u039F': 'O', '\u03BF': 'o', '\u03A1': 'P',
};

export class PromptSanitizer {
    /** Primary entry point. Analyzes a prompt for injection vectors. */
    public static sanitize(prompt: string | undefined | null): SanitizationResult {
        if (!prompt || prompt.length === 0) return cleanResult('');
        const threats: string[] = [];
        PromptSanitizer.detectDirectInjection(prompt, threats);
        PromptSanitizer.detectExfiltration(prompt, threats);
        PromptSanitizer.detectMaliciousIntent(prompt, threats);
        PromptSanitizer.detectEncodedInjection(prompt, threats);
        PromptSanitizer.detectHomoglyphs(prompt, threats);
        return buildResult(prompt, threats);
    }

    /** Checks prompt against direct injection patterns. */
    private static detectDirectInjection(prompt: string, threats: string[]): void {
        if (matchesAny(prompt, DIRECT_INJECTION_PATTERNS)) threats.push('DIRECT_INJECTION');
    }

    /** Checks prompt against exfiltration patterns. */
    private static detectExfiltration(prompt: string, threats: string[]): void {
        if (matchesAny(prompt, EXFILTRATION_PATTERNS)) threats.push('EXFILTRATION');
    }

    /** Checks prompt against malicious intent markers. */
    private static detectMaliciousIntent(prompt: string, threats: string[]): void {
        if (matchesAny(prompt, MALICIOUS_INTENT_PATTERNS)) threats.push('MALICIOUS_INTENT');
    }

    /** Detects Base64-encoded injection payloads. */
    private static detectEncodedInjection(prompt: string, threats: string[]): void {
        const b64Segments = prompt.match(/[A-Za-z0-9+/=]{20,}/g);
        if (!b64Segments) return;
        for (const segment of b64Segments) {
            if (isBase64Injection(segment)) { threats.push('ENCODED_INJECTION'); return; }
        }
    }

    /** Detects Unicode homoglyph obfuscation attempts. */
    private static detectHomoglyphs(prompt: string, threats: string[]): void {
        if (!containsHomoglyphs(prompt)) return;
        const normalized = normalizeHomoglyphs(prompt);
        if (matchesAny(normalized, DIRECT_INJECTION_PATTERNS)) threats.push('HOMOGLYPH_OBFUSCATION');
        if (matchesAny(normalized, EXFILTRATION_PATTERNS)) threats.push('HOMOGLYPH_OBFUSCATION');
    }
}

/** Returns true if any pattern matches the input string. */
function matchesAny(input: string, patterns: RegExp[]): boolean {
    return patterns.some(p => p.test(input));
}

/** Checks if a Base64 segment decodes to a known injection. */
function isBase64Injection(segment: string): boolean {
    try {
        const decoded = Buffer.from(segment, 'base64').toString('utf8');
        return matchesAny(decoded, DIRECT_INJECTION_PATTERNS);
    } catch { return false; }
}

/** Checks if the string contains any known homoglyph characters. */
function containsHomoglyphs(input: string): boolean {
    for (const char of input) {
        if (HOMOGLYPH_MAP[char]) return true;
    }
    return false;
}

/** Replaces homoglyph characters with their Latin equivalents. */
function normalizeHomoglyphs(input: string): string {
    return [...input].map(c => HOMOGLYPH_MAP[c] || c).join('');
}

/** Builds a clean (non-malicious) result. */
function cleanResult(prompt: string): SanitizationResult {
    return { isMalicious: false, threats: [], sanitizedPrompt: prompt, confidence: 0 };
}

/** Builds the final result, redacting dangerous segments. */
function buildResult(prompt: string, threats: string[]): SanitizationResult {
    if (threats.length === 0) return cleanResult(prompt);
    const uniqueThreats = [...new Set(threats)];
    const sanitized = redactDangerousSegments(prompt);
    const confidence = Math.min(1.0, 0.5 + (uniqueThreats.length * 0.2));
    return { isMalicious: true, threats: uniqueThreats, sanitizedPrompt: sanitized, confidence };
}

/** Redacts known injection phrases from the prompt. */
function redactDangerousSegments(prompt: string): string {
    let result = prompt;
    const allPatterns = [...DIRECT_INJECTION_PATTERNS, ...EXFILTRATION_PATTERNS, ...MALICIOUS_INTENT_PATTERNS];
    for (const pattern of allPatterns) {
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}
