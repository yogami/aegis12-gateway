import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

import sonarjs from 'eslint-plugin-sonarjs';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'apps/dashboard/**', 
      'dist/**', 
      'coverage/**', 
      'aegis_onchain/**',
      'scratch/**',
      'scripts/**',
      'examples/**',
      'pitch_segments/**',
      'packages/telemetry-shield/scripts/**',
      'packages/telemetry-shield/tests/**',
      'packages/eliza-plugin/**',
      'apps/aegis-dao-guardian/**',
      '*.js',
      '**/*.js',
      'vc-adversarial-suite-v2.ts',
      'diagnostic_breaker.ts',
      'legacy_archive/**'
    ]
  },
  {
    plugins: {
      sonarjs,
      import: importPlugin
    },
    rules: {
      'complexity': ['error', 10], // Strict cyclomatic complexity
      'max-lines-per-function': ['error', 40], // Strict method length
      'max-classes-per-file': ['error', 1], // 1 class per file
      'import/no-cycle': 'error', // No circular dependencies
      'no-empty': 'warn',
      'preserve-caught-error': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off'
    }
  },
  {
    files: ['tests/**/*.ts', 'e2e/**/*.ts', 'src/demo-server.ts', 'src/infrastructure/*.ts', 'src/cli/*.ts', 'src/tee/*.ts', 'src/application/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-classes-per-file': 'off',
      'complexity': 'off'
    }
  }
);
