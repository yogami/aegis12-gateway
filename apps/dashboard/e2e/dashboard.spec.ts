import { test, expect } from '@playwright/test';

test.describe('Aegis-12 Dashboard Control Panel', () => {
  test('should render the active policies empty state correctly', async ({ page }) => {
    // Navigate to the dashboard control panel
    await page.goto('/dashboard');

    // Verify the Header
    await expect(page.getByRole('heading', { name: 'Firewall Control Panel' })).toBeVisible();

    // Verify the "Deploy New Policy" button is present
    await expect(page.getByRole('button', { name: 'Deploy New Policy' })).toBeVisible();

    // Verify the Empty State
    await expect(page.getByRole('heading', { name: 'No Active Policies' })).toBeVisible();
    await expect(page.getByText('You haven\'t configured any hardware constraints')).toBeVisible();

    // Verify the SDK Documentation link
    await expect(page.getByRole('link', { name: /Read the SDK Documentation/i })).toBeVisible();

    // Verify the Aegis Attestation Verifier Program section
    await expect(page.getByRole('heading', { name: 'Aegis On-Chain Verifier Registry' })).toBeVisible();
    await expect(page.locator('text=VALID_SQUADS_PCR0_WHITELIST')).toBeVisible();
    await expect(page.locator('code')).toContainText('require!(aegis::verify_attestation());');
  });
});
