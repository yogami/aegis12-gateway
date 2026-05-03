import { test, expect } from '@playwright/test';

test.describe('Wallet Firewall Simulator', () => {
  test('should successfully deny a high value SOL transfer', async ({ page }) => {
    // Navigate to the firewall simulator
    await page.goto('/simulator/firewall');
    
    // Assert heading and loaded form
    await expect(page.getByRole('heading', { name: 'Wallet Firewall Simulator' })).toBeVisible();

    // Ensure the default output state is visible
    await expect(page.getByText('Waiting for transaction payload...')).toBeVisible();

    // Fill out the simulation parameters for a High Value Transfer denial
    // Select T1 agent
    await page.locator('select').nth(0).selectOption('T1');
    
    // Select Standard SOL Transfer
    await page.locator('select').nth(1).selectOption('transfer');
    
    // Set amount to 6000 (limit is typically 5000 in our mock rules)
    await page.getByRole('spinbutton').fill('6000');

    // Execute the simulation
    await page.getByRole('button', { name: 'Simulate Firewall Execution' }).click();

    // Assert that the UI correctly transitioned to the denial state
    await expect(page.getByRole('heading', { name: 'denied' })).toBeVisible();
    
    // Verify the explicit security flag rule
    await expect(page.getByText('HIGH_VALUE_TRANSFER')).toBeVisible();
    await expect(page.getByText(/SOL transfer of 6000 exceeds limit/)).toBeVisible();
  });

  test('should escalate a write operation for a T1 read-only agent', async ({ page }) => {
    await page.goto('/simulator/firewall');
    
    // Select T1 agent
    await page.locator('select').nth(0).selectOption('T1');
    
    // Select SPL Token SetAuthority (which is a write operation)
    await page.locator('select').nth(1).selectOption('set_authority');

    await page.getByRole('button', { name: 'Simulate Firewall Execution' }).click();

    // This triggers both TOKEN_SET_AUTHORITY (critical -> denied)
    // TIER_RESTRICTION (high -> escalated)
    // The firewall fails to 'denied' if any CRITICAL flag exists.
    await expect(page.getByRole('heading', { name: 'denied' })).toBeVisible();
    await expect(page.getByText('TOKEN_SET_AUTHORITY')).toBeVisible();
    await expect(page.getByText('TIER_RESTRICTION')).toBeVisible();
  });
});
