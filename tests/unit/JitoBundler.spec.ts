import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JitoBundler } from '../../src/infrastructure/JitoBundler';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
    default: mockFetch
}));

describe('JitoBundler (Unit)', () => {
    let bundler: JitoBundler;

    beforeEach(() => {
        vi.clearAllMocks();
        bundler = new JitoBundler();
        process.env.SOLANA_CLUSTER = 'devnet'; // Default back to devnet
    });

    it('returns devnet mock when not on mainnet', async () => {
        const res = await bundler.broadcastAtomicBundle('tx1', 'tx2');
        expect(res.status).toBe('success');
        expect(res.bundleId).toMatch(/^jito-mock-/);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('submits bundle via fetch on mainnet', async () => {
        process.env.SOLANA_CLUSTER = 'mainnet-beta';
        mockFetch.mockResolvedValueOnce({
            json: vi.fn().mockResolvedValue({ result: 'bundle-123' })
        });

        const res = await bundler.broadcastAtomicBundle('tx1', 'tx2');
        
        expect(mockFetch).toHaveBeenCalledWith(
            'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('sendBundle')
            })
        );
        expect(res.status).toBe('success');
        expect(res.bundleId).toBe('bundle-123');
    });

    it('handles Jito API errors', async () => {
        process.env.SOLANA_CLUSTER = 'mainnet-beta';
        mockFetch.mockResolvedValueOnce({
            json: vi.fn().mockResolvedValue({ error: { message: 'Simulation Failed' } })
        });

        const res = await bundler.broadcastAtomicBundle('tx1', 'tx2');
        
        expect(res.status).toBe('error');
        expect(res.error).toBe('Simulation Failed');
    });

    it('catches network/fetch exceptions', async () => {
        process.env.SOLANA_CLUSTER = 'mainnet-beta';
        mockFetch.mockRejectedValueOnce(new Error('Network Timeout'));

        const res = await bundler.broadcastAtomicBundle('tx1', 'tx2');
        
        expect(res.status).toBe('error');
        expect(res.error).toBe('Network Timeout');
    });
});
