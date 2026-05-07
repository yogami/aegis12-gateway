import { test, expect } from '@playwright/test';

test.describe('VaultBot Heist Simulator (Day 2 Pivot)', () => {
  test.skip('verifies the UI exclusively targets the live Phala TEE Enclave, not Railway', async ({ page }) => {
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

  test.skip('verifies Prompt Injection (x402) triggers Active Defense and Contextual Sanitization UI', async ({ page }) => {
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
    test.setTimeout(150000); // Allow up to 150 seconds for real Devnet anchoring and TEE proof generation
    await page.goto(`/simulator`);

    // Select the Safe scenario
    const safeBtn = page.locator('button', { hasText: 'Normal Payment' });
    await safeBtn.click();

    // Click the execute button
    const executeBtn = page.locator('button', { hasText: 'Execute Transaction' });
    await executeBtn.click();

    // Wait for the Evidence Package to be dumped to the terminal logs
    // Increase timeout to 150s because we are waiting for real Devnet anchoring and Phala proofs which can take 120s+
    await expect(page.locator('text=Evidence Package:')).toBeVisible({ timeout: 150000 });
    // Expect dynamic properties rather than hardcoded POL_SAFE_01 string since we don't mock the inner contents anymore
    await expect(page.locator('text=ledgerTx')).toBeVisible({ timeout: 150000 });
    await expect(page.locator('text=x402Header')).toBeVisible({ timeout: 150000 });
    // Expect the new ZK Seal verification UI
    await expect(page.locator('text=zkSeal')).toBeVisible({ timeout: 150000 });
    await expect(page.locator('text=ZK-Seal Cryptographically Anchored to Solana')).toBeVisible({ timeout: 150000 });
  });
  test.skip('should escalate a massive transfer and return a Squads V4 envelope', async ({ page }) => {
    test.setTimeout(150000); // Allow up to 150 seconds for TEE processing
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
    await expect(page.locator('text=Massive transfer exceeds HOTL thresholds')).toBeVisible({ timeout: 150000 });
    await expect(page.locator('text=Transaction rerouted to Squads V4 Multisig')).toBeVisible({ timeout: 150000 });
  });

  test('verifies Confidential Vault Payment successfully overrides dynamic limits', async ({ page }) => {
    test.setTimeout(150000); 
    await page.goto(`/simulator`);

    // Select the Vault scenario
    const vaultBtn = page.locator('button', { hasText: 'Confidential Vault Payment' });
    await vaultBtn.click();

    // Verify UI reflects Vault context
    await expect(page.locator('text=Policy Reference: POL_VAULT_01')).toBeVisible();

    const requestPromise = page.waitForRequest(request => request.url().includes('/api/sign_and_execute') && request.method() === 'POST');

    // Click the execute button
    const executeBtn = page.locator('button', { hasText: 'Execute Transaction' });
    await executeBtn.click();

    // Verify vault upload log
    await expect(page.locator('text=Uploading Highly Permissive Limits to Confidential TEE Vault...')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Secret rules secured in hardware memory.')).toBeVisible({ timeout: 10000 });

    const request = await requestPromise;
    const postData = JSON.parse(request.postData() || '{}');
    
    expect(postData.action.parameters.amount).toBe(100000);
    expect(postData.dynamicPolicy.policyConfig.policyId).toBe('POL_VAULT_01');

    // Verify it was approved despite the massive transfer limit
    await expect(page.locator('text=Transaction Approved via Hardware Enclave Vault Limits.')).toBeVisible({ timeout: 150000 });
    await expect(page.locator('text=Secret Vault Policy Override Activated.')).toBeVisible({ timeout: 150000 });
  });
});
