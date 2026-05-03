import { test, expect } from '@playwright/test';

test.describe('Agent Directory Substance', () => {
  test('should render verified mock agents and their compliance tags', async ({ page }) => {
    // Navigate to agents page
    await page.goto('/agents');
    
    // Expect the page title
    await expect(page.getByRole('heading', { name: 'Agent Directory' })).toBeVisible();

    // Verify "MediChat AI" is displayed (is_verified = true in mock)
    await expect(page.getByRole('heading', { name: 'MediChat AI' })).toBeVisible();
    
    // Verify "MentalHealth Ally" is displayed
    await expect(page.getByRole('heading', { name: 'MentalHealth Ally' })).toBeVisible();

    // Verify "PharmaCompliance Bot" is NOT displayed (is_verified = false in mock)
    await expect(page.getByRole('heading', { name: 'PharmaCompliance Bot' })).not.toBeVisible();

    // Verify compliance tags are rendered
    await expect(page.getByText('GDPR').first()).toBeVisible();
    await expect(page.getByText('HIPAA').first()).toBeVisible();
  });

  test('should navigate to the new agent registration page', async ({ page }) => {
    await page.goto('/agents');
    
    // Click the Register New Agent button
    await page.getByRole('link', { name: /Register New Agent/i }).click();

    // Verify we landed on the correct page
    await expect(page).toHaveURL(/.*\/admin\/agents\/new/);
    await expect(page.getByRole('heading', { name: 'Register New Agent' })).toBeVisible();
  });
});
