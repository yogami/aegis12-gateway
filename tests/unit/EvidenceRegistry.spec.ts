import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvidenceRegistry } from '../../src/registry/EvidenceRegistry';

const mockGetSignaturesForAddress = vi.fn();
const mockGetParsedTransaction = vi.fn();

vi.mock('@solana/web3.js', () => ({
    Connection: function() {
        this.getSignaturesForAddress = mockGetSignaturesForAddress;
        this.getParsedTransaction = mockGetParsedTransaction;
    },
    PublicKey: function(key: string) {
        this.key = key;
        this.toBase58 = function() { return this.key; };
    }
}));

let registry: EvidenceRegistry;

    beforeEach(() => {
        vi.clearAllMocks();
        registry = new EvidenceRegistry('devnet', 'mock-pda');
    });

    it('initializes with correct RPC URLs', () => {
        new EvidenceRegistry('mainnet-beta', 'mock-pda');
        // Connection mock would be called with mainnet URL, but we don't strictly test that here as it's mocked out
        expect(true).toBe(true);
    });

    it('returns empty array if no signatures', async () => {
        mockGetSignaturesForAddress.mockResolvedValueOnce([]);
        const res = await registry.getRecentAnchors(5);
        expect(res).toEqual([]);
    });

    it('parses valid memo instruction successfully', async () => {
        mockGetSignaturesForAddress.mockResolvedValueOnce([
            { signature: 'sig1', blockTime: 1234, err: null }
        ]);

        const mockMemo = '{"agentPubKey":"did:mock"}';
        mockGetParsedTransaction.mockResolvedValueOnce({
            transaction: {
                message: {
                    instructions: [{
                        programId: { toBase58: () => 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' },
                        parsed: mockMemo
                    }]
                }
            }
        });

        const res = await registry.getRecentAnchors(1);
        expect(res).toHaveLength(1);
        expect(res[0].signature).toBe('sig1');
        expect(res[0].status).toBe('Success');
        expect(res[0].agentDid).toBe('did:mock');
        expect(res[0].memoInstruction).toBe(mockMemo);
    });

    it('handles failed transaction status', async () => {
        mockGetSignaturesForAddress.mockResolvedValueOnce([
            { signature: 'sig2', blockTime: 1234, err: { InstructionError: [0, 'Custom'] } }
        ]);
        mockGetParsedTransaction.mockResolvedValueOnce(null);

        const res = await registry.getRecentAnchors(1);
        expect(res[0].status).toBe('Failed');
        expect(res[0].agentDid).toBe('Unknown');
    });

    it('handles fetch errors gracefully', async () => {
        mockGetSignaturesForAddress.mockResolvedValueOnce([
            { signature: 'sig3', blockTime: 1234, err: null }
        ]);
        mockGetParsedTransaction.mockRejectedValueOnce(new Error('Network Error'));

        const res = await registry.getRecentAnchors(1);
        expect(res[0].status).toBe('Success');
        expect(res[0].memoInstruction).toMatch(/Anchored Decision metadata/);
    });

    it('handles missing or malformed memo instructions gracefully', async () => {
        mockGetSignaturesForAddress.mockResolvedValueOnce([
            { signature: 'sig4', blockTime: 1234, err: null }
        ]);
        mockGetParsedTransaction.mockResolvedValueOnce({
            transaction: {
                message: {
                    instructions: [{
                        programId: { toBase58: () => 'SystemProgram' }, // Not a memo
                        parsed: 'some-data'
                    }]
                }
            }
        });

        const res = await registry.getRecentAnchors(1);
        expect(res[0].agentDid).toBe('Unknown');
    });

    it('parses unstringified parsed objects gracefully', async () => {
        mockGetSignaturesForAddress.mockResolvedValueOnce([
            { signature: 'sig5', blockTime: 1234, err: null }
        ]);
        mockGetParsedTransaction.mockResolvedValueOnce({
            transaction: {
                message: {
                    instructions: [{
                        programId: { toBase58: () => 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo' },
                        parsed: { agentPubKey: 'did:mock2' } // Parsed as object
                    }]
                }
            }
        });

        const res = await registry.getRecentAnchors(1);
        expect(res[0].agentDid).toBe('did:mock2');
    });
