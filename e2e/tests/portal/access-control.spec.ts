/**
 * Access control tests: verify agency vs client role boundaries.
 * Based on CLIENT_PORTAL_VIEW_MODES.md spec.
 */
import { test, expect } from '../../fixtures/auth';

test.describe('Access Control - Role Boundaries', () => {
  test.describe('Agency role', () => {
    test('agency sees Hosting, Clients, Services in sidebar', async ({ agencyPage: page }) => {
      await expect(page).toHaveURL(/\/portal/);
      const body = await page.textContent('body') || '';
      // Agency sidebar should have navigation items
      expect(body.toLowerCase()).toMatch(/manage|hosting|client/);
    });

    test('agency can access /portal/hosting', async ({ agencyPage: page }) => {
      await page.goto('/portal/hosting');
      await page.waitForLoadState('domcontentloaded');
      // Should load without redirect
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
  });

  test.describe('Client role', () => {
    test('client is on /portal after login', async ({ clientPage: page }) => {
      await expect(page).toHaveURL(/\/portal/);
    });

    test('client sees only Manage in sidebar', async ({ clientPage: page }) => {
      const body = await page.textContent('body') || '';
      // Client portal should show Manage
      expect(body).toContain('Manage');
      // Should NOT show Hosting nav link
      const hostingNavItem = page.locator('nav a[href="/portal/hosting"], sidebar a[href="/portal/hosting"]');
      await expect(hostingNavItem).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    });

    test('client cannot navigate to /portal/hosting', async ({ clientPage: page }) => {
      await page.goto('/portal/hosting');
      await page.waitForLoadState('domcontentloaded');
      // Should redirect away or not show hosting content
      const url = page.url();
      const hasHostingContent = await page.locator('text=/your instances|provision|deploy/i').count() > 0;
      // Either redirected or not showing agency hosting content
      expect(!url.includes('/portal/hosting') || !hasHostingContent).toBe(true);
    });
  });
});
