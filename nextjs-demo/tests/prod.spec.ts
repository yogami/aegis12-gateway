import { test, expect } from '@playwright/test';

const PROD_URL = "https://aegis12-gateway.up.railway.app/";
const PROD_URL_FALLBACK = "https://aegis12-gateway-production.up.railway.app/";

test.describe('Aegis-12 Telemetry Shield Production Verification', () => {

  test('Verify Root Endpoint is Active (Not 404)', async ({ request }) => {
    let res = await request.get(PROD_URL);
    if (!res.ok() || res.status() === 404) {
      console.log(`[WARNING] Primary URL ${PROD_URL} returned ${res.status()}. Trying fallback...`);
      res = await request.get(PROD_URL_FALLBACK);
    }
    
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);
  });

  test('Verify Core Gateway Demo Mounts Successfully', async ({ page }) => {
    let response = await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 15000 });
    
    if (response?.status() === 404) {
      console.log('Switching to fallback domain for UI testing...');
      await page.goto(PROD_URL_FALLBACK, { waitUntil: 'networkidle' });
    }

    // Verify Title Integrity
    await expect(page).toHaveTitle(/Aegis-12/i);

    // Verify critical deterministic enclave telemetry is rendering
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('Aegis-12 Security Dashboard');
  });

  test('Verify Telemetry Shield & EU AI Act Compliance Workflow via TDD', async ({ page }) => {
    let response = await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 15000 });
    if (response?.status() === 404) {
      await page.goto(PROD_URL_FALLBACK, { waitUntil: 'networkidle' });
    }

    // Wait for button to be visible
    const executeBtn = page.locator('#executeAegisBtn');
    await expect(executeBtn).toBeVisible();

    // Click it to trigger the Aegis-12 pipeline
    await executeBtn.click();

    // TDD Assertions against the new DeepResearch architecture
    await expect(page.locator('body')).toContainText('Ingesting Yellowstone gRPC firehose', { timeout: 10000 });
    await expect(page.locator('body')).toContainText('Injecting synthetic decoy traffic (Chaff)', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('Generating EU AI Act (Article 12)', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('SHA-256 Compliance Anchor', { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/latency penalty/, { timeout: 15000 });
  });

});
