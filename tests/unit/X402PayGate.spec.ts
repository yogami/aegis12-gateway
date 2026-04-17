import { describe, it, expect, vi, beforeEach } from 'vitest';
import { X402PayGate } from '../../src/infrastructure/X402PayGate';

// Mock node-fetch for Jupiter oracle
vi.mock('node-fetch', () => {
    return {
        default: vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ outAmount: '20000000' }) // 20 USDC per SOL
        })
    };
});

describe('X402PayGate (Unit)', () => {
    let payGate: X402PayGate;

    beforeEach(() => {
        vi.clearAllMocks();
        payGate = new X402PayGate({ enabled: true, freeTierLimit: 2, recipientAddress: 'recip123', pricePerCall: 0.005 });
    });

    it('should return null if x402 is disabled', async () => {
        const disabledGate = new X402PayGate({ enabled: false });
        const res = await disabledGate.checkPaymentRequired('ip1');
        expect(res).toBeNull();
    });

    it('should return null if paymentHeader is provided', async () => {
        const res = await payGate.checkPaymentRequired('ip1', 'some-signature');
        expect(res).toBeNull();
    });

    it('should handle free tier correctly in dev mode', async () => {
        process.env.NODE_ENV = 'development';
        // Request 1: allowed
        expect(await payGate.checkPaymentRequired('ip2')).toBeNull();
        // Request 2: allowed
        expect(await payGate.checkPaymentRequired('ip2')).toBeNull();
        // Request 3: exhausted -> 402
        const res = await payGate.checkPaymentRequired('ip2');
        expect(res).not.toBeNull();
        expect(res?.status).toBe(402);
    });

    it('should return 402 requirement in production mode (free tier bypassed)', async () => {
        process.env.NODE_ENV = 'production';
        const res = await payGate.checkPaymentRequired('ip3');
        expect(res).not.toBeNull();
        expect(res?.status).toBe(402);
        expect(res?.amount).toBeDefined(); // amount based on oracle
    });

    it('should fail verifyPayment if no header provided', async () => {
        const res = await payGate.verifyPayment('');
        expect(res.valid).toBe(false);
    });

    it('should fail verifyPayment if transaction not found', async () => {
        (payGate as any).connection.getParsedTransaction = vi.fn().mockResolvedValue(null);
        const res = await payGate.verifyPayment('sig1');
        expect(res.valid).toBe(false);
        expect(res.error).toBe('Transaction not found');
    });

    it('should fail verifyPayment if transaction failed on-chain', async () => {
        (payGate as any).connection.getParsedTransaction = vi.fn().mockResolvedValue({
            meta: { err: 'InstructionError' },
            transaction: { message: { accountKeys: [] } }
        });
        const res = await payGate.verifyPayment('sig2');
        expect(res.valid).toBe(false);
        expect(res.error).toBe('Transaction failed on-chain');
    });

    it('should successfully verify a valid payment', async () => {
        (payGate as any).connection.getParsedTransaction = vi.fn().mockResolvedValue({
            meta: { 
                err: null,
                preTokenBalances: [{ owner: 'recip123', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { uiAmount: 10 } }],
                postTokenBalances: [{ owner: 'recip123', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { uiAmount: 11 } }] // +1 USDC
            },
            transaction: { message: { accountKeys: [{ pubkey: { toBase58: () => 'payer1' } }] } }
        });
        const res = await payGate.verifyPayment('sig-valid');
        expect(res.valid).toBe(true);
        expect(res.paidAmount).toBe(1);
    });

    it('should fail on replay of the same signature', async () => {
        (payGate as any).connection.getParsedTransaction = vi.fn().mockResolvedValue({
            meta: { 
                err: null,
                preTokenBalances: [{ owner: 'recip123', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { uiAmount: 10 } }],
                postTokenBalances: [{ owner: 'recip123', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { uiAmount: 11 } }]
            },
            transaction: { message: { accountKeys: [{ pubkey: { toBase58: () => 'payer1' } }] } }
        });
        await payGate.verifyPayment('sig-replay'); // First time passes
        const res = await payGate.verifyPayment('sig-replay'); // Second time fails
        expect(res.valid).toBe(false);
        expect(res.error).toBe('Payment signature replay detected');
    });

    it('should fail verifyPayment if insufficient amount', async () => {
        (payGate as any).connection.getParsedTransaction = vi.fn().mockResolvedValue({
            meta: { 
                err: null,
                preTokenBalances: [{ owner: 'recip123', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { uiAmount: 10 } }],
                postTokenBalances: [{ owner: 'recip123', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', uiTokenAmount: { uiAmount: 10.0001 } }] // +0.0001 USDC
            },
            transaction: { message: { accountKeys: [{ pubkey: { toBase58: () => 'payer1' } }] } }
        });
        const res = await payGate.verifyPayment('sig-invalid-amount');
        expect(res.valid).toBe(false);
        expect(res.error).toContain('Invalid payment: expected at least');
    });

    it('should return metrics', () => {
        const metrics = payGate.getMetrics();
        expect(metrics.enabled).toBe(true);
        expect(metrics.currency).toBe('USDC');
    });
});
