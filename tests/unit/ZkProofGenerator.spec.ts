import { describe, it, expect, vi } from 'vitest';
import { ZkProofGenerator } from '../../src/application/ZkProofGenerator';

// Mock AegisZKClient
vi.mock('../../src/infrastructure/AegisZKClient', () => {
    return {
        AegisZKClient: class {
            generateProof = vi.fn().mockResolvedValue('mock_zk_proof');
        }
    };
});

describe('ZkProofGenerator', () => {
    it('should successfully generate and seal ZK proof', async () => {
        const mockPep = {
            updateZkSeal: vi.fn().mockResolvedValue(true)
        };
        const mockReceipt = {
            receiptId: 'receipt-123',
            validatedParams: { amount: 1000 },
            toolId: 'test_tool'
        };

        await ZkProofGenerator.generate(mockReceipt as any, 'test_nonce', mockPep);

        expect(mockPep.updateZkSeal).toHaveBeenCalledWith('receipt-123', 'mock_zk_proof');
    });

    it('should throw if amount exceeds capacity', async () => {
        const mockPep = { updateZkSeal: vi.fn() };
        const mockReceipt = {
            receiptId: 'receipt-123',
            validatedParams: { amount: 9007199254740992n } // Exceeds MAX
        };

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        
        await ZkProofGenerator.generate(mockReceipt as any, 'test_nonce', mockPep);
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Amount exceeds ZK capacity'));
        expect(mockPep.updateZkSeal).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
