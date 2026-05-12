import { test, expect } from '@playwright/test';

test.describe('Aegis-12 Landing Page', () => {
  test('should render the hero section and features', async ({ page }) => {
    // Navigate to the root landing page
    await page.goto('/');

    // Verify the Navbar is present
    await expect(page.locator('nav')).toBeVisible();

    // Verify the Hero section
    await expect(page.getByRole('heading', { name: /Zero-Custody Remote Signer for/i })).toBeVisible();

    // Verify the Features section "Why Aegis-12?"
    await expect(page.getByRole('heading', { name: 'Why Aegis-12?' })).toBeVisible();
    await expect(page.getByText('We provide cryptographic runtime security for agentic workflows.')).toBeVisible();

    // Verify specific feature cards
    await expect(page.getByRole('heading', { name: 'TEE Enclave Security' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Zero-Custody Verification' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Solana Verifiable Logs' })).toBeVisible();
  });
});
