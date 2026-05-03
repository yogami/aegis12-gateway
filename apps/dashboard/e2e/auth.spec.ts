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

    // Verify the mock auth state in the Navbar
    // The navbar should display the demo admin's name
    const navbarText = await page.getByText('Demo Admin').isVisible();
    expect(navbarText).toBeTruthy();
  });
});
