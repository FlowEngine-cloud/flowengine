import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Only pick up test files inside src/ — excludes e2e/ and misnamed example files
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'e2e/**',
      // Not real tests — usage-examples file mistakenly named .test.ts
      'src/lib/n8n/multiAgentOrchestrator.test.ts',
    ],
    // Default environment for lib/API tests
    environment: 'node',
    // Use jsdom for React component/hook tests
    environmentMatchGlobs: [
      ['src/components/**/*.test.{ts,tsx}', 'jsdom'],
      ['src/hooks/**/*.test.{ts,tsx}', 'jsdom'],
      ['src/lib/__tests__/authRedirect.test.ts', 'jsdom'],
    ],
    // Ensure each test file gets a fresh module registry
    isolate: true,
    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts', 'src/components/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.test.*'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
