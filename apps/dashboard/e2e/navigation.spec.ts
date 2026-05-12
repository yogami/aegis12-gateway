import { test, expect } from '@playwright/test';

test.describe('Dashboard Navigation Integrity', () => {
  test('should label and disable Phase 2 mocked features in the Navbar', async ({ page }) => {
    await page.goto('/');

    // The Heist Simulator is the core feature and should be active
    const simulatorLink = page.getByRole('link', { name: 'Heist Simulator' });
    await expect(simulatorLink).toBeVisible();
    await expect(simulatorLink).toHaveAttribute('href', '/simulator');

    // Wallet Firewall is mocked and should be disabled and labeled Phase 2
    const firewallLink = page.locator('nav').getByRole('link', { name: /Wallet Firewall/i });
    await expect(firewallLink).toBeVisible();
    await expect(firewallLink).toHaveAttribute('href', '#');
    await expect(firewallLink).toHaveClass(/cursor-not-allowed/);
    await expect(firewallLink.getByText('PHASE 2')).toBeVisible();

    // Directory is mocked and should be disabled and labeled Phase 2
    const directoryLink = page.locator('nav').getByRole('link', { name: /Directory/i });
    await expect(directoryLink).toBeVisible();
    await expect(directoryLink).toHaveAttribute('href', '#');
    await expect(directoryLink).toHaveClass(/cursor-not-allowed/);
    await expect(directoryLink.getByText('PHASE 2')).toBeVisible();

    // Leaderboard is mocked and should be disabled and labeled Phase 2
    const leaderboardLink = page.locator('nav').getByRole('link', { name: /Leaderboard/i });
    await expect(leaderboardLink).toBeVisible();
    await expect(leaderboardLink).toHaveAttribute('href', '#');
    await expect(leaderboardLink).toHaveClass(/cursor-not-allowed/);
    await expect(leaderboardLink.getByText('PHASE 2')).toBeVisible();
  });
});
