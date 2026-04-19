import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const mockListen = vi.fn();
let requestHandler: (req: any, res: any) => void;

const mockCreateServer = vi.fn().mockImplementation((handler) => {
    requestHandler = handler;
    return { listen: mockListen };
});

vi.mock('http', () => ({
    createServer: mockCreateServer
}));

const mockPhalaEntrypoint = vi.fn().mockResolvedValue('{"status":"approved"}');
vi.mock('../../src/application/PhalaEntrypoint', () => ({
    default: mockPhalaEntrypoint
}));

describe('phala_cvm_server (Unit)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('initializes server and listens', async () => {
        await import('../../src/phala_cvm_server');
        expect(mockCreateServer).toHaveBeenCalled();
        expect(mockListen).toHaveBeenCalledWith(expect.any(Number), '0.0.0.0', expect.any(Function));
    });

    it('handles OPTIONS request', async () => {
        await import('../../src/phala_cvm_server');
        
        const req = { method: 'OPTIONS' };
        const res = {
            setHeader: vi.fn(),
            writeHead: vi.fn(),
            end: vi.fn()
        };

        requestHandler(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
        expect(res.writeHead).toHaveBeenCalledWith(204);
        expect(res.end).toHaveBeenCalled();
    });

    it('handles POST /evidence success', async () => {
        await import('../../src/phala_cvm_server');
        
        const req = new EventEmitter() as any;
        req.method = 'POST';
        req.url = '/evidence';
        
        const res = {
            setHeader: vi.fn(),
            writeHead: vi.fn(),
            end: vi.fn()
        };

        requestHandler(req, res);
        
        // Simulate data stream
        req.emit('data', Buffer.from('payload-data'));
        
        // Wait for end
        const endPromise = new Promise(resolve => {
            res.end.mockImplementation(resolve);
            req.emit('end');
        });
        
        await endPromise;

        expect(mockPhalaEntrypoint).toHaveBeenCalledWith('payload-data');
        expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining('"status":"approved"'));
    });

    it('handles POST /evidence error', async () => {
        mockPhalaEntrypoint.mockRejectedValueOnce(new Error('Hardware Failure'));
        await import('../../src/phala_cvm_server');
        
        const req = new EventEmitter() as any;
        req.method = 'POST';
        req.url = '/evidence';
        
        const res = {
            setHeader: vi.fn(),
            writeHead: vi.fn(),
            end: vi.fn()
        };

        requestHandler(req, res);
        req.emit('end');
        
        const endPromise = new Promise(resolve => {
            res.end.mockImplementation(resolve);
        });
        
        await endPromise;

        expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Hardware Failure'));
    });

    it('handles unknown routes with 404', async () => {
        await import('../../src/phala_cvm_server');
        
        const req = { method: 'GET', url: '/unknown' };
        const res = {
            setHeader: vi.fn(),
            writeHead: vi.fn(),
            end: vi.fn()
        };

        requestHandler(req, res);

        expect(res.writeHead).toHaveBeenCalledWith(404);
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Enclave Invalid Route'));
    });
    
    it('handles stream error gracefully', async () => {
        await import('../../src/phala_cvm_server');
        
        const req = new EventEmitter() as any;
        req.method = 'POST';
        req.url = '/evidence';
        
        const res = {
            setHeader: vi.fn(),
            writeHead: vi.fn(),
            end: vi.fn()
        };

        requestHandler(req, res);
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        req.emit('error', new Error('Stream failed'));
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Stream Error'));
        consoleSpy.mockRestore();
    });
});
