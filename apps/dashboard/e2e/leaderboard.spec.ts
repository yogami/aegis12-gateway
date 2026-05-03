import { test, expect } from '@playwright/test';

test.describe('Aegis Score Leaderboard', () => {
  test('should render the top deterministic agents and their trust scores', async ({ page }) => {
    // Navigate to leaderboard page
    await page.goto('/leaderboard');
    
    // Expect the page title and description
    await expect(page.getByRole('heading', { name: 'Aegis Score Leaderboard' })).toBeVisible();
    await expect(page.getByText('The top verified digital health AI agents')).toBeVisible();

    // The USE_MOCK_REPO=true route should return exactly 2 agents:
    // "MediChat AI" (Score 95) and "MentalHealth Ally" (Score 88)
    
    // Verify MediChat AI is rendered and crowned (Rank 1)
    await expect(page.getByRole('heading', { name: /MediChat AI/ })).toBeVisible();
    await expect(page.getByText('95')).toBeVisible();
    await expect(page.getByText('🥇')).toBeVisible();

    // Verify MentalHealth Ally is rendered (Rank 2)
    await expect(page.getByRole('heading', { name: /MentalHealth Ally/ })).toBeVisible();
    await expect(page.getByText('88')).toBeVisible();
    await expect(page.getByText('🥈')).toBeVisible();

    // Verify Compliance Tags render correctly on the leaderboard
    await expect(page.getByText('HIPAA').first()).toBeVisible();
  });
});
