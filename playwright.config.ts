import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  // Run tests in parallel
  workers: 4,
});
