import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockListen = vi.fn().mockResolvedValue(undefined);
const mockRegister = vi.fn();
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockFastify = vi.fn().mockReturnValue({
    register: mockRegister,
    get: mockGet,
    post: mockPost,
    listen: mockListen
});

vi.mock('fastify', () => ({ default: mockFastify }));

// Mock PhalaEntrypoint
const mockPhala = vi.fn().mockResolvedValue(JSON.stringify({ status: 'approved' }));
const mockEnclave = {
    getInstance: () => mockEnclave,
    initialize: vi.fn().mockResolvedValue(undefined),
    getHardwareMetadata: vi.fn().mockResolvedValue({ attestation: 'mock-attestation', pcr0: 'mock-pcr0' }),
    pep: { provisionTenant: vi.fn(), getEvidence: vi.fn(), getEvidenceByReceiptId: vi.fn() },
    signer: { enclaveDid: 'did:mock', sign: vi.fn().mockReturnValue('mock-sig'), getPublicKeyHex: vi.fn().mockReturnValue('deadbeef'), getPQPublicKeyHex: vi.fn().mockReturnValue('pq-deadbeef') },
    anchor: { getPayerPublicKey: vi.fn().mockReturnValue('MockPayer'), anchorReceipt: vi.fn(), verifyAnchoredReceipt: vi.fn() }
};

vi.mock('../../src/application/PhalaEntrypoint', () => ({
    default: mockPhala,
    AegisEnclave: mockEnclave
}));

// Mock X402PayGate
const mockVerifyPayment = vi.fn().mockResolvedValue({ valid: true });
const mockCheckPaymentRequired = vi.fn().mockResolvedValue(null);
vi.mock('../../src/infrastructure/X402PayGate', () => ({
    X402PayGate: class {
        verifyPayment = mockVerifyPayment;
        checkPaymentRequired = mockCheckPaymentRequired;
    }
}));

describe('AegisFastifyServer (Unit)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear require cache to re-evaluate the file
        vi.resetModules();
    });

    it('initializes server and defines routes', async () => {
        await import('../../src/infrastructure/web/AegisFastifyServer');
        
        expect(mockFastify).toHaveBeenCalled();
        expect(mockGet).toHaveBeenCalledWith('/health', expect.any(Function));
        expect(mockGet).toHaveBeenCalledWith('/api/docs', expect.any(Function));
        expect(mockPost).toHaveBeenCalledWith('/enforce', expect.any(Function));
        expect(mockListen).toHaveBeenCalled();
    });

    it('health endpoint returns status', async () => {
        await import('../../src/infrastructure/web/AegisFastifyServer');
        const healthHandler = mockGet.mock.calls.find(call => call[0] === '/health')?.[1];
        
        if (healthHandler) {
            const res = await healthHandler();
            expect(res.status).toBe('alive');
            expect(res.enclaveDid).toBeDefined();
        } else {
            expect(mockGet).toHaveBeenCalledWith('/health', expect.any(Function));
        }
    });

    it('docs endpoint returns docs', async () => {
        await import('../../src/infrastructure/web/AegisFastifyServer');
        const docsHandler = mockGet.mock.calls.find(call => call[0] === '/api/docs')[1];
        
        const res = await docsHandler();
        expect(res.status).toBe('ONLINE');
    });

    it('enforce endpoint handles valid payment and approved action', async () => {
        await import('../../src/infrastructure/web/AegisFastifyServer');
        const enforceHandler = mockPost.mock.calls.find(call => call[0] === '/enforce')[1];
        
        const req = {
            ip: '127.0.0.1',
            headers: { 'x-payment': 'mock-sig' },
            body: { action: {}, dynamicPolicy: {} }
        };
        const reply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn()
        };
        
        await enforceHandler(req, reply);
        
        expect(mockVerifyPayment).toHaveBeenCalledWith('mock-sig');
        expect(mockPhala).toHaveBeenCalled();
        expect(reply.status).toHaveBeenCalledWith(200);
        expect(reply.send).toHaveBeenCalledWith({ status: 'approved' });
    });

    it('enforce endpoint handles payment required', async () => {
        mockCheckPaymentRequired.mockResolvedValueOnce({ status: 402 });
        await import('../../src/infrastructure/web/AegisFastifyServer');
        const enforceHandler = mockPost.mock.calls.find(call => call[0] === '/enforce')[1];
        
        const req = {
            ip: '127.0.0.1',
            headers: {},
            body: { action: {}, dynamicPolicy: {} }
        };
        const reply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn()
        };
        
        await enforceHandler(req, reply);
        
        expect(mockCheckPaymentRequired).toHaveBeenCalledWith('127.0.0.1');
        expect(reply.status).toHaveBeenCalledWith(402);
        expect(reply.send).toHaveBeenCalledWith({ status: 402 });
    });

    it('enforce endpoint handles invalid payment', async () => {
        mockVerifyPayment.mockResolvedValueOnce({ valid: false, error: 'invalid' });
        await import('../../src/infrastructure/web/AegisFastifyServer');
        const enforceHandler = mockPost.mock.calls.find(call => call[0] === '/enforce')[1];
        
        const req = {
            ip: '127.0.0.1',
            headers: { 'x-payment': 'invalid-sig' },
            body: { action: {}, dynamicPolicy: {} }
        };
        const reply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn()
        };
        
        await enforceHandler(req, reply);
        
        expect(reply.status).toHaveBeenCalledWith(402);
        expect(reply.send).toHaveBeenCalledWith({ error: 'invalid' });
    });

    it('enforce endpoint handles denied action', async () => {
        mockPhala.mockResolvedValueOnce(JSON.stringify({ status: 'denied' }));
        await import('../../src/infrastructure/web/AegisFastifyServer');
        const enforceHandler = mockPost.mock.calls.find(call => call[0] === '/enforce')[1];
        
        const req = {
            ip: '127.0.0.1',
            headers: {},
            body: { action: {}, dynamicPolicy: {} }
        };
        const reply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn()
        };
        
        await enforceHandler(req, reply);
        
        expect(reply.status).toHaveBeenCalledWith(403);
    });

    it('enforce endpoint catches internal errors', async () => {
        mockPhala.mockRejectedValueOnce(new Error('Internal'));
        await import('../../src/infrastructure/web/AegisFastifyServer');
        const enforceHandler = mockPost.mock.calls.find(call => call[0] === '/enforce')[1];
        
        const req = {
            ip: '127.0.0.1',
            headers: {},
            body: { action: {}, dynamicPolicy: {} }
        };
        const reply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn()
        };
        
        await enforceHandler(req, reply);
        
        expect(reply.status).toHaveBeenCalledWith(500);
        expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', error: expect.any(String) }));
    });
});
