import { AegisCanonicalMessage } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class AegisJournal {
    private journalPath: string;
    private unbatchedEntries: Map<string, AegisCanonicalMessage> = new Map();

    constructor(logPath: string = '.aegis_journal.log') {
        this.journalPath = path.resolve(process.cwd(), logPath);
        this.recoverState();
    }

    private recoverState() {
        if (!fs.existsSync(this.journalPath)) return;

        const lines = fs.readFileSync(this.journalPath, 'utf-8').split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const entry = JSON.parse(line);
                if (entry.type === 'APPEND') {
                    this.unbatchedEntries.set(entry.data.nonce, entry.data);
                } else if (entry.type === 'BATCHED') {
                    for (const nonce of entry.nonces) {
                        this.unbatchedEntries.delete(nonce);
                    }
                }
            } catch (e) {
                console.error(`[AegisJournal] Failed to parse journal line: ${line}`);
            }
        }
    }

    /**
     * Synchronously appends the intent to the WAL.
     * This MUST complete before the Ed25519 "ALLOW" signature is returned.
     */
    public appendSync(message: AegisCanonicalMessage): boolean {
        try {
            const entry = JSON.stringify({ type: 'APPEND', data: message });
            fs.appendFileSync(this.journalPath, entry + '\n', { encoding: 'utf-8', flag: 'a' });
            this.unbatchedEntries.set(message.nonce, message);
            return true;
        } catch (e: any) {
            console.error(`[AegisJournal] ⛔ FATAL: Failed to synchronously write intent. ${e.message}`);
            return false;
        }
    }

    public getUnbatchedEntries(): AegisCanonicalMessage[] {
        return Array.from(this.unbatchedEntries.values());
    }

    /**
     * Marks specific nonces as batched and anchored.
     */
    public markAsBatched(nonces: string[]): void {
        if (nonces.length === 0) return;
        try {
            const entry = JSON.stringify({ type: 'BATCHED', nonces });
            fs.appendFileSync(this.journalPath, entry + '\n', { encoding: 'utf-8', flag: 'a' });
            for (const nonce of nonces) {
                this.unbatchedEntries.delete(nonce);
            }
        } catch (e: any) {
             console.error(`[AegisJournal] ⚠️ Failed to mark entries as batched. ${e.message}`);
        }
    }
}
