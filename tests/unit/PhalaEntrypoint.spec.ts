import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnforce } = vi.hoisted(() => {
    return { mockEnforce: vi.fn() };
});

vi.mock('../../src/infrastructure/AegisPEP', () => {
    return {
        AegisPEP: class {
            enforce = mockEnforce;
        }
    };
});
import phalaEntrypoint, { handleHealthtechRequest, injectTestTrust } from '../../src/application/PhalaEntrypoint';

describe('phala-entry (Unit)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('denies invalid JSON payload', async () => {
        const resStr = await phalaEntrypoint('invalid{json');
        const res = JSON.parse(resStr);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('is not valid JSON');
    });

    it('approves a valid request via phalaEntrypoint', async () => {
        mockEnforce.mockResolvedValue({ toolId: 'swap', signature: 'sig-1' });
        const reqStr = JSON.stringify({ action: { toolId: 'swap' } });
        const resStr = await phalaEntrypoint(reqStr);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('approved');
        expect(res.receipt.toolId).toBe('swap');
    });

    it('denies an invalid request via handleHealthtechRequest', async () => {
        const reqStr = JSON.stringify({ action: { toolId: 'health_tool' } });
        const resStr = await handleHealthtechRequest(reqStr);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('denied');
    });

    it('denies when enforce throws', async () => {
        mockEnforce.mockRejectedValue(new Error('Policy breached'));
        const reqStr = JSON.stringify({ action: { toolId: 'bad_tool' } });
        const resStr = await phalaEntrypoint(reqStr);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('Policy breached');
    });

    it('throws fatals if test node config is not present during trust injection', () => {
        const tempNodeEnv = process.env.NODE_ENV;
        const tempAllow = process.env.ALLOW_E2E_MOCKING;
        process.env.NODE_ENV = 'production';
        expect(() => injectTestTrust('t-1', 'addr')).toThrow('[FATAL]');
        process.env.NODE_ENV = tempNodeEnv;
        process.env.ALLOW_E2E_MOCKING = tempAllow;
    });
});
