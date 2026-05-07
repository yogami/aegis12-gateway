import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 20000,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.test.ts', 'tests/integration/**/*.spec.ts', 'tests/chaos.spec.ts', 'tests/e2e/**/*.spec.ts', 'vc-adversarial-suite-v2.ts'],
    exclude: ['tests/e2e/hotl_flow.spec.ts', 'tests/e2e/pilot_validation.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts']
    },
  },
});
