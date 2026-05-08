import { test, expect } from '@playwright/test';

test.describe('Aegis-12 Railway Control Plane UI - Comprehensive Edge Case Suite', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Verify the UI loads correctly
    await expect(page.locator('h1')).toHaveText('RAILWAY CONTROL PLANE');
  });

  test.describe('1. Policy Configuration (Fiduciary Firewall)', () => {
    test('Standard Path: Should update the maxTradeSol limit successfully', async ({ page }) => {
      const input = page.locator('#policy-max-trade');
      const submitBtn = page.locator('#btn-update-policy');
      const terminal = page.locator('#telemetry-terminal');

      await input.fill('0.10');
      await submitBtn.click();

      await expect(terminal).toContainText('✅ [POLICY] Fiduciary limit updated to 0.10 SOL.');
    });

    test('Edge Case: Should reject negative numbers', async ({ page }) => {
      const input = page.locator('#policy-max-trade');
      const submitBtn = page.locator('#btn-update-policy');
      const terminal = page.locator('#telemetry-terminal');

      await input.fill('-5');
      await submitBtn.click();

      await expect(terminal).toContainText('🛑 [ERROR] Invalid policy value. Must be between 0 and 1000 SOL.');
    });

    test('Edge Case: Should reject alphabetical strings', async ({ page }) => {
      const input = page.locator('#policy-max-trade');
      const submitBtn = page.locator('#btn-update-policy');
      const terminal = page.locator('#telemetry-terminal');

      await input.fill('abc');
      await submitBtn.click();

      await expect(terminal).toContainText('🛑 [ERROR] Invalid policy value. Must be between 0 and 1000 SOL.');
    });

    test('Edge Case: Should reject astronomically high limits', async ({ page }) => {
      const input = page.locator('#policy-max-trade');
      const submitBtn = page.locator('#btn-update-policy');
      const terminal = page.locator('#telemetry-terminal');

      await input.fill('1000000');
      await submitBtn.click();

      await expect(terminal).toContainText('🛑 [ERROR] Invalid policy value. Must be between 0 and 1000 SOL.');
    });
  });

  test.describe('2. Telemetry & Log Stream Resilience', () => {
    test('Standard Path: Should stream mock hardware SSE logs', async ({ page }) => {
      const btn = page.getByRole('button', { name: '▶ Trigger Intent Stream' });
      const terminal = page.locator('#telemetry-terminal');

      await btn.click();

      await expect(terminal).toContainText('>>> STAGE 1: BOOTING TEE ENCLAVE & ATTESTATION <<<');
      await expect(terminal).toContainText('✅ DCAP Verified', { timeout: 5000 });
      await expect(terminal).toContainText('✅ Execution successful!', { timeout: 5000 });
    });

    test('Edge Case: Should display reconnection warnings gracefully', async ({ page }) => {
      const btn = page.locator('#btn-network-disconnect');
      const terminal = page.locator('#telemetry-terminal');

      await btn.click();

      await expect(terminal).toContainText('⚠️ [NETWORK] WebSocket connection lost. Reconnecting...');
    });
  });

  test.describe('3. Circuit Breaker / Lockdown State', () => {
    test('Standard Path: Should initiate lockdown and disable controls', async ({ page }) => {
      const btnLockdown = page.locator('#btn-trigger-lockdown');
      const terminal = page.locator('#telemetry-terminal');
      const badge = page.locator('#enclave-status');
      const input = page.locator('#policy-max-trade');
      const submitBtn = page.locator('#btn-update-policy');

      // Trigger lockdown
      await btnLockdown.click();

      // UI should reflect lockdown
      await expect(terminal).toContainText('🔴 [ALERT] MULTIPLE ANOMALOUS INTENTS DETECTED!');
      await expect(terminal).toContainText('🔒 [CIRCUIT BREAKER] LOCKDOWN INITIATED. ENCLAVE HALTED.');
      await expect(badge).toContainText('🔴 LOCKDOWN INITIATED');
      await expect(badge).toHaveClass(/animate-pulse/);

      // Edge Case: Should explicitly disable policy configuration
      await expect(input).toBeDisabled();
      await expect(submitBtn).toBeDisabled();
    });

    test('Edge Case: Should block policy updates during lockdown if forced', async ({ page }) => {
      const btnLockdown = page.locator('#btn-trigger-lockdown');
      const terminal = page.locator('#telemetry-terminal');
      const submitBtn = page.locator('#btn-update-policy');

      await btnLockdown.click();

      // Force click the submit button even though it's disabled (simulating DOM tampering)
      await submitBtn.evaluate((node: HTMLButtonElement) => {
        node.disabled = false;
        node.click();
      });

      await expect(terminal).toContainText('🛑 [ERROR] Cannot update policy during active LOCKDOWN state.');
    });
  });

  test.describe('4. Hardware Moat Visualization', () => {
    test('Standard Path: Should display Secure Enclave Active on boot', async ({ page }) => {
      const badge = page.locator('#enclave-status');
      await expect(badge).toContainText('🟢 SECURE ENCLAVE ACTIVE');
    });
  });

});
