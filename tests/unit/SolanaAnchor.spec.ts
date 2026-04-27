import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SolanaAnchor } from '../../src/infrastructure/SolanaAnchor';

vi.mock('@solana/web3.js', () => {
    class MockConnection {
        getLatestBlockhash = vi.fn().mockResolvedValue({ blockhash: 'mock-blockhash' });
        getSlot = vi.fn().mockResolvedValue(12345);
        getParsedTransaction = vi.fn().mockImplementation((sig) => {
            if (sig === 'tx-sig') {
                const memoContent = 'a12:eyJoIjoiaGFzaDEyMzQiLCJhY3QiOiJhY3QtMSIsImQiOiJhcHByb3ZlZCIsImRpZCI6InVua25vd24ifQ';
                return Promise.resolve({
                    slot: 12345,
                    blockTime: 1625097600,
                    transaction: {
                        message: {
                            instructions: [
                                {
                                    programId: { toBase58: () => 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr' },
                                    // Simulate Buffer from RPC
                                    data: Buffer.from(memoContent, 'utf8')
                                }
                            ]
                        }
                    }
                });
            }
            return Promise.resolve(null);
        });
    }

    class MockTransaction {
        recentBlockhash = '';
        feePayer = null;
        add = vi.fn().mockReturnThis();
    }

    return {
        Connection: MockConnection,
        Transaction: MockTransaction,
        Keypair: {
            generate: () => ({ secretKey: new Uint8Array(64), publicKey: { toBase58: () => 'pk' } }),
            fromSecretKey: () => ({ publicKey: { toBase58: () => 'pk' } })
        },
        sendAndConfirmTransaction: vi.fn().mockResolvedValue('tx-sig'),
        clusterApiUrl: vi.fn().mockReturnValue('mock-url')
    };
});

vi.mock('@solana/spl-memo', () => ({
    createMemoInstruction: vi.fn().mockReturnValue({})
}));

describe('SolanaAnchor (Unit)', () => {
    let anchor: SolanaAnchor;

    beforeEach(() => {
        anchor = new SolanaAnchor('devnet');
    });

    it('initializes correctly', () => {
        expect(anchor).toBeDefined();
    });

    it('computes receipt hash using JsonUtils', () => {
        const receipt = { actionId: 'act-1', toolId: 'transfer', signature: 'sig' };
        const h = anchor.computeReceiptHash(receipt);
        expect(h).toHaveLength(64);
    });

    it('anchors a receipt successfully', async () => {
        const receipt = { actionId: 'act-1', timestamp: '2021-01-01' };
        const res = await anchor.anchorReceipt(receipt, 'approved', 'did:aegis:123');
        expect(res.txSignature).toBe('tx-sig');
        expect(res.receiptHash).toHaveLength(64);
    });

    it('verifies an anchored receipt', async () => {
        const signer = { 
            verify: vi.fn().mockReturnValue(true),
            getPublicKeyHex: vi.fn().mockReturnValue('pk')
        } as any;
        const receipt = { actionId: 'act-1', signature: 'sig', enclaveDid: 'unknown' } as any;
        
        vi.spyOn(anchor, 'computeReceiptHash').mockReturnValue('hash1234');

        const res = await anchor.verifyAnchoredReceipt('tx-sig', receipt, signer);
        expect(res.verified).toBe(true);
    });
});
