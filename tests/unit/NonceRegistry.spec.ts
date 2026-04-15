import { expect, test, describe, beforeEach, afterEach, vi } from 'vitest';
import { AegisLocalNonceRegistry } from '../../src/infrastructure/NonceRegistry';
import * as fs from 'fs';
import * as path from 'path';

describe('NonceRegistry (Unit)', () => {
    const testWalPath = path.resolve(process.cwd(), '.aegis_wal.json');

    beforeEach(() => {
        vi.unstubAllGlobals();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
        if (fs.existsSync(testWalPath)) fs.unlinkSync(testWalPath);
    });

    afterEach(() => {
        if (fs.existsSync(testWalPath)) fs.unlinkSync(testWalPath);
    });

    test('reserves new nonce', async () => {
        const registry = new AegisLocalNonceRegistry();
        const res = await registry.reserve('nonce-1');
        expect(res).toBe(true);
    });

    test('fails resolving duplicate pending nonce', async () => {
        const registry = new AegisLocalNonceRegistry();
        await registry.reserve('nonce-1');
        const res = await registry.reserve('nonce-1');
        expect(res).toBe(false);
    });

    test('commits nonce and writes to WAL', async () => {
        const registry = new AegisLocalNonceRegistry();
        await registry.reserve('nonce-2');
        await registry.commit('nonce-2');
        
        // Cannot reserve a committed nonce
        const res = await registry.reserve('nonce-2');
        expect(res).toBe(false);
        
        // WAL file should exist
        expect(fs.existsSync(testWalPath)).toBe(true);
    });

    test('recovers from WAL', async () => {
        fs.writeFileSync(testWalPath, JSON.stringify(['prev-nonce-1']));
        const registry = new AegisLocalNonceRegistry();
        expect(await registry.reserve('prev-nonce-1')).toBe(false);
    });

    test('rolls back pending nonce', async () => {
        const registry = new AegisLocalNonceRegistry();
        await registry.reserve('nonce-3');
        await registry.rollback('nonce-3');
        const res = await registry.reserve('nonce-3');
        expect(res).toBe(true);
    });
});
