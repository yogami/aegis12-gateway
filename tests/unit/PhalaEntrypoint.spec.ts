import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockEnforce } = vi.hoisted(() => {
    return { mockEnforce: vi.fn() };
});

vi.mock('../../src/infrastructure/AegisPEP', () => {
    return {
        AegisPEP: class {
            enforce = mockEnforce;
            provisionTenant = vi.fn();
            saveEvidence = vi.fn();
            getEvidence = vi.fn();
        }
    };
});

vi.mock('../../src/infrastructure/AegisZKClient', () => {
    return {
        AegisZKClient: class {
            async generateProof() {
                return { seal: 'mock_seal', vkey: 'mock_vkey' };
            }
        }
    };
});

vi.mock('../../src/infrastructure/AegisSigner', () => {
    return {
        AegisSigner: {
            create: vi.fn().mockResolvedValue({
                enclaveDid: 'did:aegis:test',
                sign: vi.fn().mockReturnValue('mock-sig'),
                getPublicKeyHex: vi.fn().mockReturnValue('deadbeef'),
                signEIP712: vi.fn().mockResolvedValue('mock-eip712-sig')
            })
        }
    };
});

vi.mock('../../src/infrastructure/SolanaAnchor', () => {
    return {
        SolanaAnchor: class {
            getPayerPublicKey = vi.fn().mockReturnValue('MockPayerPubkey');
            anchorReceipt = vi.fn().mockResolvedValue({ txSignature: 'mock-tx', explorerUrl: 'https://mock' });
        }
    };
});
import phalaEntrypoint from '../../src/application/PhalaEntrypoint';

describe('phala-entry (Unit)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock TEE hardware attestation (required by PCR0 check in phalaEntrypoint)
        globalThis.phala = {
            getQuote: (_did: string) => ({ quote: 'mock-attestation-quote', measurement: 'mock-pcr0-hash' })
        };
    });

    it('denies invalid JSON payload', async () => {
        const resStr = await phalaEntrypoint('invalid{json');
        const res = JSON.parse(resStr);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('is not valid JSON');
    });

    it('approves a valid request via phalaEntrypoint', async () => {
        mockEnforce.mockResolvedValue({ toolId: 'swap', signature: 'sig-1' });
        const reqStr = JSON.stringify({ action: { toolId: 'swap' } });
        const resStr = await phalaEntrypoint(reqStr);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('approved');
        expect(res.receipt.toolId).toBe('swap');
    });

    it('denies when enforce throws', async () => {
        mockEnforce.mockRejectedValue(new Error('Policy breached'));
        const reqStr = JSON.stringify({ action: { toolId: 'bad_tool' } });
        const resStr = await phalaEntrypoint(reqStr);
        const res = JSON.parse(resStr);
        expect(res.status).toBe('denied');
        expect(res.error).toContain('Policy breached');
    });
});
