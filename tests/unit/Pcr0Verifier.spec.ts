import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Pcr0Verifier } from '../../src/application/Pcr0Verifier';
import { TerminalRefusalError } from '../../src/errors';

describe('Pcr0Verifier', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    it('should skip check if APPROVED_PCR0 is SKIP_PCR0_CHECK', () => {
        process.env.APPROVED_PCR0 = 'SKIP_PCR0_CHECK';
        expect(() => Pcr0Verifier.verify('anything')).not.toThrow();
    });

    it('should pass if pcr0 matches approved quote', () => {
        process.env.APPROVED_PCR0 = 'valid_quote_123';
        process.env.NODE_ENV = 'production';
        expect(() => Pcr0Verifier.verify('valid_quote_123')).not.toThrow();
    });

    it('should throw TerminalRefusalError if pcr0 does not match', () => {
        process.env.APPROVED_PCR0 = 'valid_quote_123';
        process.env.NODE_ENV = 'production';
        expect(() => Pcr0Verifier.verify('invalid_quote')).toThrowError(TerminalRefusalError);
    });

    it('should bypass check in test environment', () => {
        process.env.APPROVED_PCR0 = 'valid_quote_123';
        process.env.NODE_ENV = 'test';
        expect(() => Pcr0Verifier.verify('invalid_quote_but_in_test_env')).not.toThrow();
    });
});
