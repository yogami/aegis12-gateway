import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = util.promisify(exec);

describe('Blackbox Suite: DAO Guardian End-to-End Flow', () => {
    const guardianScript = path.resolve(__dirname, '../../apps/aegis-dao-guardian/src/index.ts');
    const manifestFile = path.resolve(__dirname, '../../apps/aegis-dao-guardian/src/squadmanifest.json');

    beforeAll(() => {
        if (fs.existsSync(manifestFile)) {
            fs.unlinkSync(manifestFile);
        }
    });

    afterAll(() => {
        if (fs.existsSync(manifestFile)) {
            fs.unlinkSync(manifestFile);
        }
    });

    it('should successfully execute the jailbroken agent demo and generate a squadmanifest.json', async () => {
        const { stdout, stderr } = await execAsync(`npx ts-node ${guardianScript}`);
        
        // Assert output contains VERA and BLOCKED messages
        expect(stdout).toContain('[Phala TEE Enclave] Receiving Intent from Agent');
        expect(stdout).toContain('BLOCKED');
        expect(stdout).toContain('VERA Protocol');
        expect(stdout).toContain('Reputation updated (Offline Demo Mode). New FICO Trust Score:');

        // Assert the manifest file was written
        expect(fs.existsSync(manifestFile)).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        expect(manifest.status).toBe('BLOCKED');
        expect(manifest.policyViolations.length).toBeGreaterThan(0);
        expect(manifest.teeAttestationHash).toBeDefined();
    }, 15000);
});
