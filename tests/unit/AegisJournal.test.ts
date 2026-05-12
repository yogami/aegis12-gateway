import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AegisJournal } from '../../src/infrastructure/AegisJournal';
import { AegisCanonicalMessage } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

const journalPath = path.resolve(process.cwd(), '.aegis_test_journal.log');
    let journal: AegisJournal;

    beforeEach(() => {
        if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
        journal = new AegisJournal(journalPath);
    });

    afterEach(() => {
        if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
    });

    it('should synchronously append an intent', () => {
        const msg: AegisCanonicalMessage = {
            tenantId: 'tenant-1',
            nonce: 'nonce-1',
            article12LogHash: '0xhash1',
            timestamp: new Date().toISOString()
        };

        const success = journal.appendSync(msg);
        expect(success).toBe(true);

        const content = fs.readFileSync(journalPath, 'utf-8');
        expect(content).toContain('nonce-1');
        expect(content).toContain('0xhash1');
    });

    it('should retrieve unbatched entries and clear them upon batching', () => {
        const msg1: AegisCanonicalMessage = { tenantId: 't1', nonce: 'n1', article12LogHash: 'h1', timestamp: 't1' };
        const msg2: AegisCanonicalMessage = { tenantId: 't1', nonce: 'n2', article12LogHash: 'h2', timestamp: 't2' };
        
        journal.appendSync(msg1);
        journal.appendSync(msg2);

        const unbatched = journal.getUnbatchedEntries();
        expect(unbatched.length).toBe(2);

        // Simulate batching
        journal.markAsBatched(unbatched.map(m => m.nonce));

        const unbatchedAfter = journal.getUnbatchedEntries();
        expect(unbatchedAfter.length).toBe(0);
    });

    it('should recover state from an existing WAL file', () => {
        const msg: AegisCanonicalMessage = { tenantId: 't1', nonce: 'n1', article12LogHash: 'h1', timestamp: 't1' };
        journal.appendSync(msg);

        // Simulate crash / restart
        const recoveredJournal = new AegisJournal(journalPath);
        const unbatched = recoveredJournal.getUnbatchedEntries();
        
        expect(unbatched.length).toBe(1);
        expect(unbatched[0].nonce).toBe('n1');
    });
