import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AegisZKClient } from '../../src/infrastructure/AegisZKClient';
import * as fs from 'fs';
import * as child_process from 'child_process';

vi.mock('fs');
vi.mock('child_process');

let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws if binary not found', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);
        expect(() => new AegisZKClient()).toThrow(/ZK Prover binary not found/);
    });

    it('throws if AEGIS_ZK_PROVER_HASH is missing', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-binary'));
        delete process.env.AEGIS_ZK_PROVER_HASH;
        expect(() => new AegisZKClient()).toThrow(/AEGIS_ZK_PROVER_HASH environment variable is strictly required/);
    });

    it('throws if checksum mismatch', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('mock-binary'));
        process.env.AEGIS_ZK_PROVER_HASH = 'invalid-hash';
        expect(() => new AegisZKClient()).toThrow(/Prover binary checksum mismatch/);
    });

    it('initializes if checksum matches', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        const fileContent = Buffer.from('mock-binary');
        vi.mocked(fs.readFileSync).mockReturnValue(fileContent);
        
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
        process.env.AEGIS_ZK_PROVER_HASH = hash;

        expect(() => new AegisZKClient()).not.toThrow();
    });

    it('generates proof successfully', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        const fileContent = Buffer.from('mock-binary');
        vi.mocked(fs.readFileSync).mockReturnValue(fileContent);
        const hash = require('crypto').createHash('sha256').update(fileContent).digest('hex');
        process.env.AEGIS_ZK_PROVER_HASH = hash;

        const client = new AegisZKClient();

        vi.mocked(child_process.execFile).mockImplementation((file, args, options, callback: any) => {
            callback(null, JSON.stringify({ seal: 'mock-seal', vkey: 'mock-vkey' }), '');
            return { stdin: { write: vi.fn(), end: vi.fn() } } as any;
        });

        const res = await client.generateProof({ input: 'data' });
        expect(res.seal).toBe('mock-seal');
        expect(res.vkey).toBe('mock-vkey');
    });

    it('handles exec errors', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        const fileContent = Buffer.from('mock-binary');
        vi.mocked(fs.readFileSync).mockReturnValue(fileContent);
        process.env.AEGIS_ZK_PROVER_HASH = require('crypto').createHash('sha256').update(fileContent).digest('hex');

        const client = new AegisZKClient();

        vi.mocked(child_process.execFile).mockImplementation((file, args, options, callback: any) => {
            callback({ code: 1 }, '', 'stderr message');
            return { stdin: { write: vi.fn(), end: vi.fn() } } as any;
        });

        await expect(client.generateProof({})).rejects.toThrow(/Prover exited with code 1/);
    });

    it('handles invalid JSON output', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        const fileContent = Buffer.from('mock-binary');
        vi.mocked(fs.readFileSync).mockReturnValue(fileContent);
        process.env.AEGIS_ZK_PROVER_HASH = require('crypto').createHash('sha256').update(fileContent).digest('hex');

        const client = new AegisZKClient();

        vi.mocked(child_process.execFile).mockImplementation((file, args, options, callback: any) => {
            callback(null, 'invalid json', '');
            return { stdin: { write: vi.fn(), end: vi.fn() } } as any;
        });

        await expect(client.generateProof({})).rejects.toThrow(/Failed to parse prover output/);
    });

    it('handles invalid schema output', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        const fileContent = Buffer.from('mock-binary');
        vi.mocked(fs.readFileSync).mockReturnValue(fileContent);
        process.env.AEGIS_ZK_PROVER_HASH = require('crypto').createHash('sha256').update(fileContent).digest('hex');

        const client = new AegisZKClient();

        vi.mocked(child_process.execFile).mockImplementation((file, args, options, callback: any) => {
            callback(null, JSON.stringify({ wrong: 'schema' }), '');
            return { stdin: { write: vi.fn(), end: vi.fn() } } as any;
        });

        await expect(client.generateProof({})).rejects.toThrow(/Prover output missing 'seal' or invalid/);
    });
