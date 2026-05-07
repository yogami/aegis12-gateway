import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 1,
    use: {
        baseURL: process.env.TEST_API_URL || 'http://localhost:8080',
        extraHTTPHeaders: {
            'Content-Type': 'application/json',
        },
    },
    workers: 1,
    webServer: process.env.TEST_API_URL ? undefined : {
        command: 'PORT=8080 SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=e3f686d4-1710-4a8e-a2f4-4f147052af29 NODE_ENV=test ALLOW_E2E_MOCKING=false PHALA_SIMULATED_ROOT_SEED=0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd SOLANA_CLUSTER=devnet AUTHORIZED_TENANTS=\'{"tenant-council": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"], "tenant-e2e": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"]}\' npx tsx src/phala_cvm_server.ts',
        port: 8080,
        timeout: 30000,
        reuseExistingServer: true,
    },
    reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
});
