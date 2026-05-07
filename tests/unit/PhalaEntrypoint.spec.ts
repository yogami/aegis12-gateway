import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AegisEnclave } from '../../src/application/PhalaEntrypoint';

// Use vi.hoisted so these are available inside vi.mock factories
const { mockEnforce, mockSignReceipt, mockGetEvidenceByReceiptId, mockUpdateZkSeal, mockSaveEvidence } = vi.hoisted(() => ({
    mockEnforce: vi.fn(),
    mockSignReceipt: vi.fn(),
    mockGetEvidenceByReceiptId: vi.fn(),
    mockUpdateZkSeal: vi.fn(),
    mockSaveEvidence: vi.fn(),
}));

vi.mock('../../src/infrastructure/AegisSigner', () => ({
    AegisSigner: { create: vi.fn().mockResolvedValue({ enclaveDid: 'did:aegis:123', getPublicKeyHex: vi.fn().mockReturnValue('pubkey123'), sign: vi.fn().mockResolvedValue('mock-signature'), signEIP712: vi.fn().mockResolvedValue('mock-eip712-sig'), verify: vi.fn().mockReturnValue(true) }) }
}));

vi.mock('../../src/application/PepFactory', () => ({
    PepFactory: { 
        createPep: vi.fn().mockResolvedValue({ 
            pep: { 
                enforce: mockEnforce,
                signReceipt: mockSignReceipt,
                getEvidenceByReceiptId: mockGetEvidenceByReceiptId, 
                updateZkSeal: mockUpdateZkSeal,
                saveEvidence: mockSaveEvidence,
            }, 
            journal: { getUnbatchedEntries: vi.fn().mockReturnValue([]), appendSync: vi.fn().mockReturnValue(true) } 
        }) 
    }
}));

vi.mock('../../src/infrastructure/LedgerAnchorFactory', () => ({
    LedgerAnchorFactory: { create: vi.fn().mockResolvedValue({ anchorReceipt: vi.fn().mockResolvedValue({ txSignature: 'mock-tx' }), getPayerPublicKey: vi.fn().mockReturnValue('MockPayer'), anchorZkProof: vi.fn() }) }
}));

vi.mock('../../src/infrastructure/TappdClient', () => ({
    TappdClient: class MockTappdClient { getQuote() { return Promise.resolve('mock-attestation'); } }
}));

vi.mock('../../src/application/Pcr0Verifier', () => ({
    Pcr0Verifier: { verify: vi.fn() }
}));

vi.mock('../../src/infrastructure/SquadsRouter', () => ({
    SquadsRouter: { routeIfEscalated: vi.fn() }
}));

vi.mock('../../src/application/ZkProofGenerator', () => ({
    ZkProofGenerator: { generate: vi.fn().mockResolvedValue(undefined) }
}));

let enclave: AegisEnclave;

    beforeEach(() => {
        AegisEnclave.reset();
        enclave = AegisEnclave.getInstance();
        vi.clearAllMocks();
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
        mockEnforce.mockResolvedValue({
            decision: 'approved',
            receiptId: 'test_receipt',
            authorizationNonce: 'nonce',
            actionId: 'act-nonce'
        });
        mockSignReceipt.mockResolvedValue(undefined);
        mockSaveEvidence.mockResolvedValue(undefined);

        const payload = JSON.stringify({
            agent: { did: "did:aegis:test" },
            action: { toolId: "test_tool" }
        });
        
        const resStr = await enclave.processRequest(payload);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('approved');
        expect(res.ledger_tx).toBe('batching');
        expect(res.enclaveDid).toBe('did:aegis:123');
    });

    it('signs escalated receipt envelope', async () => {
        mockEnforce.mockResolvedValue({
            decision: 'escalated',
            receiptId: 'test_receipt',
            authorizationNonce: 'nonce',
            actionId: 'act-nonce',
            envelope: { vault_pda: "test_pda" }
        });
        mockSignReceipt.mockResolvedValue(undefined);
        mockSaveEvidence.mockResolvedValue(undefined);

        const payload = JSON.stringify({
            agent: { did: "did:aegis:test" },
            action: { toolId: "test_tool" }
        });

        const resStr = await enclave.processRequest(payload);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('escalated');
        expect(res.receipt.envelope.tee_signature).toBeDefined();
    });

    it('fetches evidence status successfully', async () => {
        mockGetEvidenceByReceiptId.mockResolvedValue({
            ars_anchor: 'anchor_hash',
            ledger_tx: 'tx_hash'
        });

        const statusStr = await enclave.getEvidenceStatus('test_receipt');
        const status = JSON.parse(statusStr);
        expect(status.status).toBe('COMPLETED');
        expect(status.ars_anchor).toBe('anchor_hash');
        expect(status.ledger_tx).toBe('tx_hash');
    });

    it('returns NOT_FOUND if evidence does not exist', async () => {
        mockGetEvidenceByReceiptId.mockResolvedValue(null);

        const statusStr = await enclave.getEvidenceStatus('missing_receipt');
        const status = JSON.parse(statusStr);
        expect(status.status).toBe('NOT_FOUND');
    });
