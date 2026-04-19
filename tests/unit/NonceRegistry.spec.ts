import { expect, test, describe, beforeEach, afterEach, vi } from 'vitest';
import { AegisLocalNonceRegistry } from '../../src/infrastructure/NonceRegistry';
import * as fs from 'fs';
import * as path from 'path';

describe('NonceRegistry (Unit)', () => {
    const testWalPath = path.resolve(process.cwd(), '.aegis_wal.json');
    const committedWalPath = testWalPath.replace('.json', '_committed.json');
    const pendingWalPath = testWalPath.replace('.json', '_pending.json');
    const lockPath = testWalPath.replace('.json', '.lock');

    const cleanFiles = () => {
        if (fs.existsSync(committedWalPath)) fs.unlinkSync(committedWalPath);
        if (fs.existsSync(pendingWalPath)) fs.unlinkSync(pendingWalPath);
        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
    };

    beforeEach(() => {
        vi.unstubAllGlobals();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
        cleanFiles();
    });

    afterEach(() => {
        cleanFiles();
    });

    test('reserves new nonce', async () => {
        const registry = new AegisLocalNonceRegistry(testWalPath);
        await registry.initialize();
        const res = await registry.reserve('nonce-1');
        expect(res).toBe(true);
    });

    test('fails resolving duplicate pending nonce', async () => {
        const registry = new AegisLocalNonceRegistry(testWalPath);
        await registry.initialize();
        await registry.reserve('nonce-1');
        const res = await registry.reserve('nonce-1');
        expect(res).toBe(false);
    });

    test('commits nonce and writes to WAL', async () => {
        const registry = new AegisLocalNonceRegistry(testWalPath);
        await registry.initialize();
        const res1 = await registry.reserve('nonce-2');
        expect(res1).toBe(true);
        await registry.commit('nonce-2');
        
        // Cannot reserve a committed nonce
        const res = await registry.reserve('nonce-2');
        expect(res).toBe(false);
        
        console.log("CHECKING PATH:", committedWalPath, "EXISTS:", fs.existsSync(committedWalPath));
        const dirFiles = fs.readdirSync(process.cwd());
        console.log("FILES IN CWD:", dirFiles.filter(f => f.includes('aegis_wal')));
        // WAL file should exist
        expect(fs.existsSync(committedWalPath)).toBe(true);
    });

    test('recovers from WAL', async () => {
        const registry1 = new AegisLocalNonceRegistry(testWalPath);
        await registry1.initialize();
        await registry1.reserve('prev-nonce-1');
        await registry1.commit('prev-nonce-1');

        const registry2 = new AegisLocalNonceRegistry(testWalPath);
        await registry2.initialize();
        expect(await registry2.reserve('prev-nonce-1')).toBe(false);
    });

    test('rolls back pending nonce', async () => {
        const registry = new AegisLocalNonceRegistry(testWalPath);
        await registry.initialize();
        await registry.reserve('nonce-3');
        await registry.release('nonce-3');
        const res = await registry.reserve('nonce-3');
        expect(res).toBe(true);
    });
});
