import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SolanaAnchor } from '../../src/infrastructure/SolanaAnchor';
import { Keypair } from '@solana/web3.js';
import * as web3 from '@solana/web3.js';

vi.mock('@solana/web3.js', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        sendAndConfirmTransaction: vi.fn(),
        Connection: class {
            requestAirdrop = vi.fn().mockResolvedValue('mock-sig');
            confirmTransaction = vi.fn().mockResolvedValue(true);
            getSlot = vi.fn().mockResolvedValue(12345);
            getParsedTransaction = vi.fn();
            getLatestBlockhash = vi.fn().mockResolvedValue({ blockhash: 'mock-blockhash', lastValidBlockHeight: 1000 });
        }
    };
});

describe('SolanaAnchor (Unit)', () => {
    let anchor: SolanaAnchor;

    beforeEach(() => {
        vi.clearAllMocks();
        anchor = new SolanaAnchor('devnet');
    });

    it('initializes with provided secret key', () => {
        const kp = Keypair.generate();
        const a = new SolanaAnchor('devnet', kp.secretKey);
        expect(a.getPayerPublicKey()).toBe(kp.publicKey.toBase58());
    });

    it('requests airdrop successfully', async () => {
        const sig = await anchor.requestAirdrop();
        expect(sig).toBe('mock-sig');
    });

    it('computes receipt hash deterministically', () => {
        const receipt: any = { b: 2, a: 1 };
        const hash1 = anchor.computeReceiptHash(receipt);
        const hash2 = anchor.computeReceiptHash({ a: 1, b: 2 } as any);
        expect(hash1).toBe(hash2);
    });

    it('sends tx with failover', async () => {
        vi.mocked(web3.sendAndConfirmTransaction).mockResolvedValueOnce('tx-sig' as never);
        const sig = await anchor.sendTxWithFailover(new web3.Transaction());
        expect(sig).toBe('tx-sig');
    });

    it('fails over if first RPC fails', async () => {
        vi.mocked(web3.sendAndConfirmTransaction)
            .mockRejectedValueOnce(new Error('RPC Error'))
            .mockResolvedValueOnce('tx-sig-2' as never);
            
        const sig = await anchor.sendTxWithFailover(new web3.Transaction());
        expect(sig).toBe('tx-sig-2');
    });

    it('throws if all RPCs fail', async () => {
        vi.mocked(web3.sendAndConfirmTransaction).mockRejectedValue(new Error('RPC Error'));
        await expect(anchor.sendTxWithFailover(new web3.Transaction())).rejects.toThrow(/All RPC fallbacks failed/);
    });

    it('anchors a standard receipt', async () => {
        vi.mocked(web3.sendAndConfirmTransaction).mockResolvedValueOnce('tx-sig' as never);
        const receipt = { actionId: 'act-1', timestamp: '2023-01-01' };
        
        const res = await anchor.anchorReceipt(receipt, 'approved', 'did:aegis:mock');
        expect(res.txSignature).toBe('tx-sig');
        expect(res.isZkSharded).toBe(false);
    });

    it('anchors a ZK-sharded receipt', async () => {
        vi.mocked(web3.sendAndConfirmTransaction).mockResolvedValueOnce('tx-sig' as never);
        const receipt = { actionId: 'act-2', timestamp: '2023-01-01', zkSnarkProof: { pi_a: [] } };
        
        const res = await anchor.anchorReceipt(receipt, 'approved', 'did:aegis:mock');
        expect(res.isZkSharded).toBe(true);
    });

    it('verifies an anchored receipt (parsed instruction string)', async () => {
        const mockConn = (anchor as any).connection;
        mockConn.getParsedTransaction.mockResolvedValue({
            slot: 123,
            blockTime: 100000,
            transaction: {
                message: {
                    instructions: [
                        { parsed: 'aegis:v4-pq:act-1:hash1234:approved:mock' }
                    ]
                }
            }
        });

        const res = await anchor.verifyAnchoredReceipt('tx-sig');
        expect(res.verified).toBe(true);
        expect(res.onChainMemo).toBe('aegis:v4-pq:act-1:hash1234:approved:mock');
    });

    it('verifies an anchored receipt (memo log)', async () => {
        const mockConn = (anchor as any).connection;
        mockConn.getParsedTransaction.mockResolvedValue({
            slot: 123,
            meta: {
                logMessages: ['Program log: Memo (len 10): "aegis:v4"']
            }
        });

        const res = await anchor.verifyAnchoredReceipt('tx-sig');
        expect(res.verified).toBe(true);
        expect(res.onChainMemo).toBe('aegis:v4');
    });

    it('returns false if transaction not found', async () => {
        const mockConn = (anchor as any).connection;
        mockConn.getParsedTransaction.mockResolvedValue(null);

        const res = await anchor.verifyAnchoredReceipt('tx-sig');
        expect(res.verified).toBe(false);
        expect(res.error).toBe('Transaction not found on Solana');
    });

    it('returns error if connection fails', async () => {
        const mockConn = (anchor as any).connection;
        mockConn.getParsedTransaction.mockRejectedValue(new Error('Network Error'));

        const res = await anchor.verifyAnchoredReceipt('tx-sig');
        expect(res.verified).toBe(false);
        expect(res.error).toBe('Network Error');
    });
});
