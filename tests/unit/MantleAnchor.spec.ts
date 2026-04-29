import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ethers, Wallet } from 'ethers';
import { MantleAnchor } from '../../src/infrastructure/MantleAnchor';

describe('MantleAnchor (Unit)', () => {
    let anchor: MantleAnchor;
    const mockPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const mockWallet = new Wallet(mockPrivateKey);

    beforeEach(() => {
        anchor = new MantleAnchor('https://rpc.sepolia.mantle.xyz', mockWallet, 'Mantle Sepolia');
    });

    it('implements ILedgerAnchor interface', () => {
        expect(typeof anchor.anchorReceipt).toBe('function');
        expect(typeof anchor.verifyAnchoredReceipt).toBe('function');
        expect(typeof anchor.getPayerPublicKey).toBe('function');
        expect(typeof anchor.getNetworkName).toBe('function');
    });

    it('returns correct network name', () => {
        expect(anchor.getNetworkName()).toBe('Mantle Sepolia');
    });

    it('returns correct payer public key (EVM address)', () => {
        const address = anchor.getPayerPublicKey();
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(address).toBe(mockWallet.address);
    });

    it('anchors receipt with correct memo format', async () => {
        const mockTxHash = '0xabc123def456';
        const mockSendTransaction = vi.fn().mockResolvedValue({
            hash: mockTxHash,
            wait: vi.fn().mockResolvedValue({ status: 1 })
        });
        
        // Override the wallet's sendTransaction
        (anchor as any).wallet = { 
            ...mockWallet, 
            address: mockWallet.address,
            sendTransaction: mockSendTransaction 
        };

        const receipt = {
            receiptId: 'aegis-v1-tenant-001-test123',
            actionId: 'act-test-001',
            article12LogHash: '0xdeadbeef',
            timestamp: '2026-04-29T22:00:00.000Z',
            decision: 'approved',
            enclaveDid: 'did:aegis:enclave:test',
            signature: '0x1234',
        } as any;

        const result = await anchor.anchorReceipt(receipt, 'approved', 'did:aegis:enclave:test');
        
        expect(result.txSignature).toBe(mockTxHash);
        expect(result.explorerUrl).toContain('explorer.mantle.xyz/tx/');
        
        // Verify the calldata contains our a12: memo prefix
        const sentData = mockSendTransaction.mock.calls[0][0].data;
        const decoded = ethers.utils.toUtf8String(sentData);
        expect(decoded).toContain('a12:');
        
        // Verify the memo is valid base64url-encoded JSON
        const base64Part = decoded.split('a12:')[1];
        const memoObj = JSON.parse(Buffer.from(base64Part, 'base64url').toString('utf8'));
        expect(memoObj.act).toBe('act-test-001');
        expect(memoObj.d).toBe('approved');
        expect(memoObj.did).toBe('did:aegis:enclave:test');
        expect(memoObj.v).toBe('aegis:v8');
    });

    it('sends transaction to self (self-memo pattern)', async () => {
        const mockSendTransaction = vi.fn().mockResolvedValue({
            hash: '0x123',
            wait: vi.fn().mockResolvedValue({ status: 1 })
        });
        
        (anchor as any).wallet = { 
            ...mockWallet, 
            address: mockWallet.address,
            sendTransaction: mockSendTransaction 
        };

        await anchor.anchorReceipt({
            receiptId: 'test',
            actionId: 'test',
            article12LogHash: '0x00',
            timestamp: new Date().toISOString(),
            decision: 'approved',
            enclaveDid: 'did:test',
            signature: '0x00',
        } as any, 'approved', 'did:test');

        // Verify self-send pattern: 'to' address is the wallet's own address
        expect(mockSendTransaction.mock.calls[0][0].to).toBe(mockWallet.address);
    });

    it('handles verification of non-existent transaction gracefully', async () => {
        const mockGetTransaction = vi.fn().mockResolvedValue(null);
        (anchor as any).provider = { getTransaction: mockGetTransaction };
        
        const result = await anchor.verifyAnchoredReceipt('0xnonexistent', {} as any, {} as any);
        expect(result.verified).toBe(false);
        expect(result.error).toContain('not found');
    });
});

describe('LedgerAnchorFactory (Unit)', () => {
    it('creates SolanaAnchor by default', async () => {
        delete process.env.LEDGER_TYPE;
        const { LedgerAnchorFactory } = await import('../../src/infrastructure/LedgerAnchorFactory');
        const anchor = await LedgerAnchorFactory.create({ getEvmWallet: () => new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') } as any);
        expect(anchor.getNetworkName()).toContain('Solana');
    });

    it('creates MantleAnchor when LEDGER_TYPE=mantle', async () => {
        process.env.LEDGER_TYPE = 'mantle';
        const { LedgerAnchorFactory } = await import('../../src/infrastructure/LedgerAnchorFactory');
        const anchor = await LedgerAnchorFactory.create({ getEvmWallet: () => new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') } as any);
        expect(anchor.getNetworkName()).toContain('Mantle');
        delete process.env.LEDGER_TYPE;
    });

    it('throws on unsupported chain', async () => {
        process.env.LEDGER_TYPE = 'bitcoin';
        const { LedgerAnchorFactory } = await import('../../src/infrastructure/LedgerAnchorFactory');
        await expect(LedgerAnchorFactory.create({} as any)).rejects.toThrow('Unsupported LEDGER_TYPE');
        delete process.env.LEDGER_TYPE;
    });

    it('lists supported chains', async () => {
        const { LedgerAnchorFactory } = await import('../../src/infrastructure/LedgerAnchorFactory');
        const chains = LedgerAnchorFactory.getSupportedChains();
        expect(chains).toContain('solana');
        expect(chains).toContain('mantle');
    });
});
