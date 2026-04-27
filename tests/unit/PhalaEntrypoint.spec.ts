import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AegisEnclave } from '../../src/application/PhalaEntrypoint';

vi.mock('../../src/infrastructure/AegisSigner', () => ({
    AegisSigner: { create: vi.fn().mockResolvedValue({ enclaveDid: 'did:aegis:123' }) }
}));

describe('phala-entry (Unit)', () => {
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
        expect(res.error).toBe('Malformed JSON');
    });
});
