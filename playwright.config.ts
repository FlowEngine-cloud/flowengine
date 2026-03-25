import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  // Run API tests with 4 workers, UI tests need browser
  workers: process.env.CI ? 2 : 4,
  reporter: [['html', { open: 'never' }], ['line']],
  projects: [
    {
      name: 'api',
      testMatch: /e2e\/(api-keys|mcp-routes|invite-routes)\.spec\.ts/,
    },
    {
      name: 'chromium',
      testMatch: /e2e\/tests\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
