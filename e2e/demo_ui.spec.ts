import { test, expect } from '@playwright/test';

// Use TEST_API_URL or PHALA_IP_ADDRESS if available
const getBaseUrl = () => {
    if (process.env.TEST_API_URL) return process.env.TEST_API_URL;
    const ip = process.env.PHALA_IP_ADDRESS;
    if (ip) {
        return ip.startsWith('http') ? ip : `http://${ip}:8000`;
    }
    return 'http://localhost:8000';
};

test.describe('Aegis-12 Demo Console UI Verification', () => {
    test.use({ baseURL: getBaseUrl() });
    test.setTimeout(120000);

    test('should render the institutional dashboard with all security badges', async ({ page }) => {
        await page.goto('/');
        
        // Verify core UI elements
        await expect(page.locator('h1')).toHaveText('Aegis-12');
        
        // Verify both security status badges are present
        await expect(page.locator('.status-badge').first()).toContainText('PHALA TDX ENCLAVE ACTIVE');
        await expect(page.locator('.status-badge.zk')).toContainText('RISCZERO ZK-ATTESTATION READY');
        
        // Verify all three action buttons exist and are enabled
        await expect(page.locator('#btn-valid')).toBeEnabled();
        await expect(page.locator('#btn-escalate')).toBeEnabled();
        await expect(page.locator('#btn-malicious')).toBeEnabled();
        
        // Verify the terminal is initialized
        await expect(page.locator('#terminal')).toContainText('WAITING FOR INTENT');
    });

    test('should execute a valid trade with pre-flight simulation and ZK attestation', async ({ page }) => {
        await page.goto('/');
        
        // Click the Valid Trade button
        const btnValid = page.locator('#btn-valid');
        await btnValid.click();

        const terminal = page.locator('#terminal');
        
        // Verify the boot sequence runs (ZK attestation + hardware verification)
        await expect(terminal).toContainText('INITIATING AEGIS-12 HANDSHAKE', { timeout: 5000 });
        await expect(terminal).toContainText('Booting isolated hardware environment', { timeout: 10000 });
        
        // Verify ZK Proof generation
        await expect(terminal).toContainText('ZK Proof', { timeout: 15000 });
        
        // Verify multi-oracle verification
        await expect(terminal).toContainText('Hardware verified', { timeout: 20000 });
        
        // Verify pre-flight simulation
        await expect(terminal).toContainText('Pre-flight simulation', { timeout: 30000 });
        
        // Verify successful execution (on devnet this can take up to 30s)
        await expect(terminal).toContainText('Transaction signed inside hardware', { timeout: 45000 });
        
        // Verify the Fiduciary Registry log
        await expect(terminal).toContainText('Decision logged', { timeout: 5000 });
        
        // Verify the Solana Explorer link is present
        await expect(terminal).toContainText('Solana Explorer', { timeout: 5000 });
        
        // Assert that buttons re-enable after completion
        await expect(terminal).toContainText('HANDSHAKE COMPLETE', { timeout: 5000 });
        await expect(btnValid).not.toBeDisabled({ timeout: 5000 });
    });

    test('should block prompt injection via Fiduciary Firewall', async ({ page }) => {
        await page.goto('/');

        const btnMalicious = page.locator('#btn-malicious');
        await btnMalicious.click();

        const terminal = page.locator('#terminal');
        await expect(terminal).toContainText('INITIATING AEGIS-12 HANDSHAKE', { timeout: 5000 });
        await expect(terminal).toContainText('Attempting to drain 1.5 SOL', { timeout: 10000 });

        // The Fiduciary Firewall must block it
        await expect(terminal).toContainText('BLOCK', { timeout: 15000 });
        await expect(terminal).toContainText('physically cannot sign', { timeout: 15000 });
        
        // Verify the decision was logged to the audit registry
        await expect(terminal).toContainText('Malicious attempt logged', { timeout: 5000 });

        await expect(btnMalicious).not.toBeDisabled({ timeout: 5000 });
    });

    test('should escalate high-risk intent to Squads V4 Multisig', async ({ page }) => {
        await page.goto('/');

        const btnEscalate = page.locator('#btn-escalate');
        await btnEscalate.click();

        const terminal = page.locator('#terminal');
        await expect(terminal).toContainText('INITIATING AEGIS-12 HANDSHAKE', { timeout: 5000 });

        // The Fiduciary Firewall should escalate it
        await expect(terminal).toContainText('HIGH RISK INTENT DETECTED', { timeout: 15000 });
        await expect(terminal).toContainText('Squads Proposal Created', { timeout: 15000 });
        
        // Verify escalation was logged
        await expect(terminal).toContainText('Escalation logged', { timeout: 5000 });

        await expect(btnEscalate).not.toBeDisabled({ timeout: 5000 });
    });
});
