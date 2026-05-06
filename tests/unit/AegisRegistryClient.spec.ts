import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AegisRegistryClient } from '../../src/infrastructure/AegisRegistryClient';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

const mockRpc = vi.fn().mockResolvedValue('mock-tx-sig');
const mockMethods = {
    anchorComplianceReceipt: vi.fn().mockReturnThis(),
    checkpointNonce: vi.fn().mockReturnThis(),
    accounts: vi.fn().mockReturnValue({ rpc: mockRpc })
};

const mockFetch = vi.fn().mockResolvedValue({ lastNonce: new anchor.BN(42) });

vi.mock('@coral-xyz/anchor', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        AnchorProvider: function() {
            this.wallet = { publicKey: Keypair.generate().publicKey };
        },
        Program: function() {
            this.programId = Keypair.generate().publicKey;
            this.methods = mockMethods;
            this.account = {
                nonceCheckpoint: {
                    fetch: mockFetch
                }
            };
        }
    };
});

// Mock the IDL import
vi.mock('../../aegis12-registry/target/idl/aegis12_registry.json', () => ({
    default: { name: 'mock_idl' }
}));

let client: AegisRegistryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        const kp = Keypair.generate();
        const wallet = {
            publicKey: kp.publicKey,
            signTransaction: vi.fn(),
            signAllTransactions: vi.fn()
        };
        client = new AegisRegistryClient('http://localhost', wallet as any, Keypair.generate().publicKey.toBase58());
    });

    it('anchors receipt successfully', async () => {
        const receipt = {
            receiptId: 'receipt-1',
            article12LogHash: '0x' + '1'.repeat(64),
            signature: '0x' + '2'.repeat(128),
            article14OversightSignature: 'oversight'
        };

        const tx = await client.anchorReceipt(receipt as any);
        expect(tx).toBe('mock-tx-sig');
        expect(mockMethods.anchorComplianceReceipt).toHaveBeenCalled();
        expect(mockMethods.accounts).toHaveBeenCalled();
        expect(mockRpc).toHaveBeenCalled();
    });

    it('throws when anchoring fails', async () => {
        mockRpc.mockRejectedValueOnce(new Error('RPC Error'));
        const receipt = {
            receiptId: 'receipt-2',
            article12LogHash: '0x' + '1'.repeat(64),
            signature: '0x' + '2'.repeat(128),
            article14OversightSignature: 'oversight'
        };

        await expect(client.anchorReceipt(receipt as any)).rejects.toThrow('RPC Error');
    });

    it('checkpoints nonce successfully', async () => {
        const tx = await client.checkpointNonce('tenant-1', 5);
        expect(tx).toBe('mock-tx-sig');
        expect(mockMethods.checkpointNonce).toHaveBeenCalledWith('tenant-1', expect.any(Object));
        expect(mockRpc).toHaveBeenCalled();
    });

    it('throws when checkpoint fails', async () => {
        mockRpc.mockRejectedValueOnce(new Error('Checkpoint Error'));
        await expect(client.checkpointNonce('tenant-2', 6)).rejects.toThrow('Checkpoint Error');
    });

    it('gets last nonce successfully', async () => {
        const nonce = await client.getLastNonce('tenant-1');
        expect(nonce).toBe(42);
        expect(mockFetch).toHaveBeenCalled();
    });

    it('returns 0 if fetch fails (new tenant)', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Account not found'));
        const nonce = await client.getLastNonce('tenant-new');
        expect(nonce).toBe(0);
    });
