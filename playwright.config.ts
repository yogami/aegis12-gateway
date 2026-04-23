import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 1,
    use: {
        baseURL: process.env.TEST_API_URL || 'http://127.0.0.1:8000',
        extraHTTPHeaders: {
            'Content-Type': 'application/json',
        },
    },
    workers: 1,
    webServer: process.env.TEST_API_URL ? undefined : {
        command: 'NODE_ENV=test ALLOW_E2E_MOCKING=false PHALA_SIMULATED_ROOT_SEED=0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd SOLANA_CLUSTER=devnet AUTHORIZED_TENANTS=\'{"tenant-council": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"], "tenant-e2e": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"]}\' npx tsx src/server.ts',
        port: 8000,
        timeout: 30000,
        reuseExistingServer: true,
    },
    reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
});
