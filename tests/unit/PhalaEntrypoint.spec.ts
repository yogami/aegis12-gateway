import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AegisEnclave } from '../../src/application/PhalaEntrypoint';

vi.mock('../../src/infrastructure/AegisSigner', () => ({
    AegisSigner: { create: vi.fn().mockResolvedValue({ enclaveDid: 'did:aegis:123', getPublicKeyHex: vi.fn().mockReturnValue('pubkey123'), sign: vi.fn().mockResolvedValue('mock-signature') }) }
}));

vi.mock('../../src/application/PepFactory', () => ({
    PepFactory: { 
        createPep: vi.fn().mockResolvedValue({ 
            pep: { getEvidenceByReceiptId: vi.fn(), enforce: vi.fn(), updateZkSeal: vi.fn(), signReceipt: vi.fn() }, 
            journal: {} 
        }) 
    }
}));

let enclave: AegisEnclave;

    beforeEach(() => {
        AegisEnclave.reset();
        enclave = AegisEnclave.getInstance();
    });

    it('denies payload exceeding 128KB', async () => {
        const huge = 'a'.repeat(130 * 1024);
        const resStr = await enclave.processRequest(huge);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('exceeds 128KB');
    });

    it('denies malformed JSON payload', async () => {
        const resStr = await enclave.processRequest('{invalid');
        const res = JSON.parse(resStr);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('Malformed JSON');
    });

    it('processes valid request successfully', async () => {
        const payload = JSON.stringify({
            agent: { did: "did:aegis:test" },
            action: { toolId: "test_tool" }
        });
        
        // Mock enforce to return an approved receipt
        const { PepFactory } = await import('../../src/application/PepFactory');
        const mockEnforce = PepFactory.createPep().then((res: any) => res.pep.enforce.mockResolvedValue({
            decision: 'approved',
            receiptId: 'test_receipt',
            authorizationNonce: 'nonce'
        }));

        const resStr = await enclave.processRequest(payload);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('approved');
        expect(res.ledger_tx).toBe('batching');
        expect(res.enclaveDid).toBe('did:aegis:123');
    });

    it('signs escalated receipt envelope', async () => {
        const payload = JSON.stringify({
            agent: { did: "did:aegis:test" },
            action: { toolId: "test_tool" }
        });
        
        // Mock enforce to return an escalated receipt
        const { PepFactory } = await import('../../src/application/PepFactory');
        const mockEnforce = PepFactory.createPep().then((res: any) => res.pep.enforce.mockResolvedValue({
            decision: 'escalated',
            receiptId: 'test_receipt',
            authorizationNonce: 'nonce',
            envelope: { vault_pda: "test_pda" }
        }));

        const resStr = await enclave.processRequest(payload);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('escalated');
        expect(res.receipt.envelope.tee_signature).toBeDefined();
    });

    it('fetches evidence status successfully', async () => {
        const { PepFactory } = await import('../../src/application/PepFactory');
        const mockGetEvidence = PepFactory.createPep().then((res: any) => res.pep.getEvidenceByReceiptId.mockResolvedValue({
            ars_anchor: 'anchor_hash',
            ledger_tx: 'tx_hash'
        }));

        const statusStr = await enclave.getEvidenceStatus('test_receipt');
        const status = JSON.parse(statusStr);
        expect(status.status).toBe('COMPLETED');
        expect(status.ars_anchor).toBe('anchor_hash');
        expect(status.ledger_tx).toBe('tx_hash');
    });

    it('returns NOT_FOUND if evidence does not exist', async () => {
        const { PepFactory } = await import('../../src/application/PepFactory');
        const mockGetEvidence = PepFactory.createPep().then((res: any) => res.pep.getEvidenceByReceiptId.mockResolvedValue(null));

        const statusStr = await enclave.getEvidenceStatus('missing_receipt');
        const status = JSON.parse(statusStr);
        expect(status.status).toBe('NOT_FOUND');
    });
