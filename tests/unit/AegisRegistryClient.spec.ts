import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AegisRegistryClient } from '../../src/infrastructure/AegisRegistryClient';
import { Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

function setupMocks(client: AegisRegistryClient) {
    const mockMethodReturn = {
        accounts: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue('mock_tx_signature_receipt')
    };
    const mockNonceReturn = {
        accounts: vi.fn().mockReturnThis(),
        rpc: vi.fn().mockResolvedValue('mock_tx_signature_nonce')
    };

    client['program'] = {
        programId: new anchor.web3.PublicKey('FPVw3tMxjARfaPFqkDRJSp19vPrzGQ1fW4oJwkUgeyxS'),
        methods: {
            anchorComplianceReceipt: vi.fn().mockReturnValue(mockMethodReturn),
            checkpointNonce: vi.fn().mockReturnValue(mockNonceReturn),
        },
        account: {
            nonceCheckpoint: {
                fetch: vi.fn().mockResolvedValue({ lastNonce: new anchor.BN(5) })
            }
        }
    } as any;
}

describe('AegisRegistryClient', () => {
    let client: AegisRegistryClient;
    let wallet: anchor.Wallet;

    beforeEach(() => {
        const keypair = Keypair.generate();
        wallet = new anchor.Wallet(keypair);
        client = new AegisRegistryClient('http://127.0.0.1:8899', wallet, 'FPVw3tMxjARfaPFqkDRJSp19vPrzGQ1fW4oJwkUgeyxS');
        setupMocks(client);
    });

    it('should anchor a compliance receipt correctly', async () => {
        const mockReceipt = {
            receiptId: "receipt-123",
            policyId: "pol-123",
            article12LogHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
            signature: "0x12345678901234567890123456789012345678901234567890123456789012341234567890123456789012345678901234567890123456789012345678901234",
            timestamp: Date.now(),
            tenantId: "tenant-1",
            agentId: "agent-1",
            transactionHash: "tx-hash-mock"
        };

        const tx = await client.anchorReceipt(mockReceipt);
        expect(tx).toBe('mock_tx_signature_receipt');
        expect(client['program'].methods.anchorComplianceReceipt).toHaveBeenCalled();
    });

    it('should checkpoint a new nonce', async () => {
        const tx = await client.checkpointNonce("tenant-1", 6);
        expect(tx).toBe('mock_tx_signature_nonce');
        expect(client['program'].methods.checkpointNonce).toHaveBeenCalledWith("tenant-1", expect.anything());
    });

    it('should retrieve the last nonce', async () => {
        const nonce = await client.getLastNonce("tenant-1");
        expect(nonce).toBe(5);
        expect(client['program'].account.nonceCheckpoint.fetch).toHaveBeenCalled();
    });
});
