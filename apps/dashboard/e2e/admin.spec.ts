import { test, expect } from '@playwright/test';

test.describe('Admin Approval Flow', () => {
  // Use a beforeEach hook to log in since /admin is protected
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Try Demo/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should list pending agents and allow approval', async ({ page }) => {
    // Navigate to admin
    await page.goto('/admin');
    
    // Verify Admin Dashboard header
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();

    // Verify the unverified agent "PharmaCompliance Bot" is in the pending list
    await expect(page.getByRole('heading', { name: 'PharmaCompliance Bot' })).toBeVisible();
    
    // Click Approve
    const approveButton = page.getByRole('button', { name: /Approve/i }).first();
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // Verify the agent is removed from the pending list
    await expect(page.getByRole('heading', { name: 'PharmaCompliance Bot' })).not.toBeVisible();
  });
});
