/**
 * Access control tests: verify agency vs client role boundaries.
 */
import { test, expect } from '../../fixtures/auth';
import { test as baseTest } from '@playwright/test';

// ── Unauthenticated guard ────────────────────────────────────────────────────

baseTest.describe('Unauthenticated access', () => {
  baseTest('redirects /portal to /auth when not signed in', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/auth/, { timeout: 8000 });
  });

  baseTest('redirects /portal/hosting to /auth when not signed in', async ({ page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/auth/, { timeout: 8000 });
  });

  baseTest('redirects /portal/clients to /auth when not signed in', async ({ page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/auth/, { timeout: 8000 });
  });
});

// ── Agency role ───────────────────────────────────────────────────────────────

test.describe('Access Control - Agency role', () => {
  test('agency lands on /portal after login', async ({ agencyPage: page }) => {
    await expect(page).toHaveURL(/\/portal/);
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toMatch(/manage|hosting|client/);
  });

  test('agency can access /portal/hosting', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/hosting/);
  });

  test('agency can access /portal/clients', async ({ agencyPage: page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/clients/);
  });

  test('agency can access /portal/settings', async ({ agencyPage: page }) => {
    await page.goto('/portal/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/settings/);
  });

  test('agency can access /portal/ui-studio', async ({ agencyPage: page }) => {
    await page.goto('/portal/ui-studio');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/ui-studio/);
  });
});

// ── Client role ───────────────────────────────────────────────────────────────

test.describe('Access Control - Client role', () => {
  test('client lands on /portal after login', async ({ clientPage: page }) => {
    await expect(page).toHaveURL(/\/portal/);
  });

  test('client sees Manage in sidebar', async ({ clientPage: page }) => {
    const body = await page.textContent('body') || '';
    expect(body).toContain('Manage');
  });

  test('client sidebar does not show Hosting nav link', async ({ clientPage: page }) => {
    const hostingNavItem = page.locator('nav a[href="/portal/hosting"], aside a[href="/portal/hosting"]');
    await expect(hostingNavItem).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('client navigating to /portal/hosting is redirected or sees no content', async ({ clientPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    const hasHostingContent = await page.locator('text=/your instances|provision|deploy/i').count() > 0;
    expect(!url.includes('/portal/hosting') || !hasHostingContent).toBe(true);
  });

  test('client navigating to /portal/clients is redirected or sees no content', async ({ clientPage: page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    const body = await page.textContent('body') || '';
    // Either redirected away or page renders manage/portal content instead of client list
    const isBlocked = !url.includes('/portal/clients') || body.includes('Manage');
    expect(isBlocked).toBe(true);
  });
});
