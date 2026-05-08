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

    test('should execute a valid trade and verify SSE log stream', async ({ page }) => {
        // Go to the demo console
        await page.goto('/');
        
        // Ensure the UI loaded correctly
        await expect(page.locator('h1')).toHaveText('Aegis-12 Gateway');
        await expect(page.locator('.status-badge')).toContainText('PHALA dSTACK SECURE ENCLAVE ACTIVE');

        // Click the Valid Trade button
        const btnValid = page.locator('#btn-valid');
        await btnValid.click();

        // The terminal should immediately acknowledge the intent
        const terminal = page.locator('#terminal');
        await expect(terminal).toContainText('STARTING DEMO: VALID', { timeout: 5000 });

        // The UI should stream Server-Sent Events (SSE). We wait for the final success message.
        // On devnet, transactions can take up to 30 seconds.
        await expect(terminal).toContainText('✅ Execution successful!', { timeout: 45000 });
        
        // Assert that the execute button re-enables after completion
        await expect(btnValid).not.toBeDisabled({ timeout: 5000 });
    });

    test('should simulate prompt injection and verify Fiduciary Firewall blocks it', async ({ page }) => {
        // Go to the demo console
        await page.goto('/');

        // Click the Malicious intent button
        const btnMalicious = page.locator('#btn-malicious');
        await btnMalicious.click();

        const terminal = page.locator('#terminal');
        await expect(terminal).toContainText('STARTING DEMO: MALICIOUS', { timeout: 5000 });
        await expect(terminal).toContainText('Attempting to drain 1.5 SOL', { timeout: 5000 });

        // The Fiduciary Firewall (TEE) should block it because the limit is 0.05 SOL
        await expect(terminal).toContainText('🔒 BLOCK', { timeout: 10000 });
        await expect(terminal).toContainText('The private key physically cannot sign this payload.', { timeout: 10000 });

        // Assert that the execute button re-enables
        await expect(btnMalicious).not.toBeDisabled({ timeout: 5000 });
    });

    test('should simulate an escalated intent and verify Squads V4 Multisig fallback', async ({ page }) => {
        // Go to the demo console
        await page.goto('/');

        // Click the Escalate intent button
        const btnEscalate = page.locator('#btn-escalate');
        await btnEscalate.click();

        const terminal = page.locator('#terminal');
        await expect(terminal).toContainText('STARTING DEMO: ESCALATE', { timeout: 5000 });

        // The Fiduciary Firewall should escalate it
        await expect(terminal).toContainText('Routing to Squads V4 Multisig', { timeout: 15000 });
        await expect(terminal).toContainText('Squads Proposal Created', { timeout: 10000 });

        // Assert that the execute button re-enables
        await expect(btnEscalate).not.toBeDisabled({ timeout: 5000 });
    });
});
