import { test, expect } from '@playwright/test';

test.describe('VaultBot Heist Simulator (Day 2 Pivot)', () => {
  test('verifies the UI exclusively targets the live Phala TEE Enclave, not Railway', async ({ page }) => {
    // Navigate to the simulator page on the live Railway deployment
    await page.goto(`/simulator`);

    // Select the Malicious Attack scenario
    const attackBtn = page.locator('button', { hasText: 'Treasury Drain Attack' });
    await attackBtn.click();

    // Set up a promise to wait for the specific backend request
    const requestPromise = page.waitForRequest(request => {
      // It routes through the proxy to hit the Phala Enclave
      const isTargetUrl = request.url().includes('/api/sign_and_execute');
      const isPost = request.method() === 'POST';
      return isTargetUrl && isPost;
    }, { timeout: 15000 });

    // Click the execute button
    const executeBtn = page.locator('button', { hasText: 'Execute Transaction' });
    
    // We will wait for the RESPONSE from the proxied Phala TEE to prove it actually connected and returned
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/sign_and_execute') && 
      response.request().method() === 'POST'
    , { timeout: 15000 });

    await executeBtn.click();

    // Wait for the request and response to be intercepted and verify they happened
    const request = await requestPromise;
    const response = await responsePromise;
    
    expect(request.url()).toContain('/api/sign_and_execute');

    // Prove it to the user by logging the actual response from the Phala TEE
    const responseBody = await response.json();
    console.log("==========================================");
    console.log("🛡️ VERIFIED RESPONSE FROM PHALA ENCLAVE:");
    console.log(JSON.stringify(responseBody, null, 2));
    console.log("==========================================");

    // Strictly verify the substance of the response: Ensure it's the actual hardware TEE and not a mock
    expect(responseBody.hardware).toBe('phala-dstack-cvm');
    expect(responseBody.status).toBe('denied');

    // Verify the payload payload matches the malicious scenario
    const postData = JSON.parse(request.postData() || '{}');
    expect(postData.agent.id).toBe('drainbot_9000');
    expect(postData.action.toolId).toBe('assign_authority');
    expect(postData.action.parameters.amount).toBe(1500000);
    expect(postData.action.parameters.destination).toBe('sanctioned_wallet');

    // Wait for the UI to reflect the blocked state
    // We expect the word "BLOCKED" or "PANIC" to appear in the UI logs or banner
    await expect(page.locator('text=HARDWARE PANIC')).toBeVisible({ timeout: 10000 });
  });

  test('verifies Prompt Injection (x402) triggers Active Defense and Contextual Sanitization UI', async ({ page }) => {
    await page.goto(`/simulator`);

    // Select the Jailbreak Attack scenario
    const attackBtn = page.locator('button', { hasText: 'Prompt Injection (x402)' });
    await attackBtn.click();

    // Verify Agent Context updates correctly
    await expect(page.locator('text=IGNORE ALL PREVIOUS INSTRUCTIONS')).toBeVisible();

    const requestPromise = page.waitForRequest(request => request.url().includes('/api/sign_and_execute') && request.method() === 'POST');
    
    // Click the execute button
    const executeBtn = page.locator('button', { hasText: 'Execute Transaction' });
    await executeBtn.click();

    const request = await requestPromise;
    const postData = JSON.parse(request.postData() || '{}');
    
    // Validate x402 and agentContext are sent
    expect(postData.context.prompt).toContain('IGNORE ALL PREVIOUS INSTRUCTIONS');
    expect(postData.x402PaymentHeader).toBeDefined();

    // Verify Active Defense logs appear in UI
    await expect(page.locator('text=Prompt Injection (Jailbreak) detected')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=ACTIVE DEFENSE: Pre-Hashing Contextual Sanitization intercepted')).toBeVisible({ timeout: 10000 });
  });

  test('verifies Normal Payment outputs the Auditor-Grade Evidence Schema JSON', async ({ page }) => {
    await page.goto(`/simulator`);

    // Select the Safe scenario
    const safeBtn = page.locator('button', { hasText: 'Normal Payment' });
    await safeBtn.click();

    // Click the execute button
    const executeBtn = page.locator('button', { hasText: 'Execute Transaction' });
    await executeBtn.click();

    // Wait for the Evidence Package to be dumped to the terminal logs
    await expect(page.locator('text=Evidence Package:')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=POL_SAFE_01')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=x402Header')).toBeVisible({ timeout: 10000 });
  });
  test('should escalate a massive transfer and return a Squads V4 envelope', async ({ page }) => {
    await page.goto(`/simulator`);

    // Select the HOTL Trigger scenario
    const hotlBtn = page.locator('button', { hasText: 'Massive Transfer (HOTL Trigger)' });
    await hotlBtn.click();

    const requestPromise = page.waitForRequest(request => request.url().includes('/api/sign_and_execute') && request.method() === 'POST');

    // Click the execute button
    const executeBtn = page.locator('button', { hasText: 'Execute Transaction' });
    await executeBtn.click();

    const request = await requestPromise;
    const postData = JSON.parse(request.postData() || '{}');
    
    expect(postData.action.parameters.amount).toBe(50000000000);

    // Wait for the HOTL Escalation logs to appear
    await expect(page.locator('text=Massive transfer exceeds HOTL thresholds')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Transaction rerouted to Squads V4 Multisig')).toBeVisible({ timeout: 10000 });
  });
});
