import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should allow a user to mock login and view dashboard', async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    
    // Expect the login header
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

    // Click the demo login button
    await page.getByRole('button', { name: /Try Demo/i }).click();

    // Expect redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verify the mock auth state persists across hard navigations
    await page.reload();
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // The navbar should display the Firewall Panel button for authenticated users
    await expect(page.getByRole('link', { name: 'Firewall Panel' })).toBeVisible({ timeout: 10000 });
  });
});
