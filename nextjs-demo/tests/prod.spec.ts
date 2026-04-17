import { test, expect } from '@playwright/test';

const PROD_URL = "https://aegis12-gateway.up.railway.app/";

test.describe('Aegis-12 Production Validation (Un-mocked Architecture)', () => {

  test('Verify Root Endpoint is Active', async ({ request }) => {
    let res = await request.get(PROD_URL);
    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);
  });

  test('Verify Live Telemetry Shield Execution Strings', async ({ page }) => {
    await page.goto(PROD_URL, { waitUntil: 'networkidle', timeout: 15000 });

    const executeBtn = page.locator('#executeAegisBtn');
    await expect(executeBtn).toBeVisible();

    await executeBtn.click();

    // TDD Assertions against the un-mocked architecture logs
    await expect(page.locator('body')).toContainText('Ingesting live Devnet blockhash', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('Chaff network payloads dispersed across RPC', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('SHA-256 Compliance Hash:', { timeout: 15000 });
    await expect(page.locator('body')).toContainText('latency penalty', { timeout: 15000 });
  });

  test('Verify Headless Agent API (/api/execute) Returns Valid Cryptographic JSON', async ({ request }) => {
    const dummyAgentPayload = {
      agent_id: "playwright_tester",
      routes: [{"pool": "RAY-USDC", "rate": 0.5}],
      intent: "obfuscate"
    };

    const response = await request.post(`${PROD_URL}api/execute`, {
      data: dummyAgentPayload
    });

    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    
    // Validate the core un-mocked mathematical JSON structure
    expect(body).toHaveProperty('status', 200);
    expect(body).toHaveProperty('protocol', 'Aegis-12 Enterprise Gateway');
    expect(body.metrics).toHaveProperty('hash_penalty_ms');
    expect(body.metrics).toHaveProperty('chaff_dispersal_ms');
    expect(body.compliance).toHaveProperty('sha256_anchor');
    expect(body.compliance).toHaveProperty('anchor_status');
    expect(body.compliance).toHaveProperty('explorer_url');
  });

});
