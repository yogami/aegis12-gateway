import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 1,
    use: {
        baseURL: process.env.TEST_API_URL || 'http://localhost:8000',
        extraHTTPHeaders: {
            'Content-Type': 'application/json',
        },
    },
    workers: 1,
    webServer: process.env.TEST_API_URL ? undefined : {
        command: 'PORT=8000 SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=e3f686d4-1710-4a8e-a2f4-4f147052af29 NODE_ENV=test npx tsx src/demo-server.ts',
        port: 8000,
        timeout: 30000,
        reuseExistingServer: true,
    },
    reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
});
