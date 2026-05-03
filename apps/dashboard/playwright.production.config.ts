import { defineConfig, devices } from '@playwright/test';

/**
 * Production E2E Test Configuration
 * Runs against the live Railway deployment
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: true,
    retries: 2,
    workers: 2,
    reporter: [['html', { open: 'never' }], ['list']],
    timeout: 60000,
    expect: {
        timeout: 15000,
    },
    use: {
        baseURL: 'https://agent-trust-protocol-production.up.railway.app',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    // No webServer - we're testing against production
});
