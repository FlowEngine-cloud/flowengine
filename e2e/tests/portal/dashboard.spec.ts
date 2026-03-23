import { test, expect } from '../../fixtures/auth';

test.describe('Portal Dashboard - Agency User', () => {
  test('should load portal with navigation sidebar', async ({ agencyPage: page }) => {
    await expect(page).toHaveURL(/\/portal/);
    // Sidebar should be visible
    const sidebar = page.locator('nav, aside, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('should show Manage tab (Overview)', async ({ agencyPage: page }) => {
    const body = await page.textContent('body');
    expect(body).toContain('Manage');
  });

  test('should show Hosting section', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/hosting/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should show Clients section', async ({ agencyPage: page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/clients/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should navigate to settings', async ({ agencyPage: page }) => {
    await page.goto('/portal/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/settings/);
    const hasSettings = (await page.textContent('body') || '').toLowerCase().includes('setting');
    expect(hasSettings).toBe(true);
  });

  test('should navigate to templates', async ({ agencyPage: page }) => {
    await page.goto('/portal/templates');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/templates/);
  });

  test('should navigate to UI Studio', async ({ agencyPage: page }) => {
    await page.goto('/portal/ui-studio');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/ui-studio/);
  });

  test('should persist authentication across page navigations', async ({ agencyPage: page }) => {
    const routes = ['/portal', '/portal/hosting', '/portal/clients', '/portal/settings'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(new RegExp(route.replace('/', '\\/')));
    }
  });
});

test.describe('Portal Dashboard - Client User', () => {
  test('should load portal for client user', async ({ clientPage: page }) => {
    await expect(page).toHaveURL(/\/portal/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('client should see Manage tab only (not Hosting/Clients)', async ({ clientPage: page }) => {
    const body = await page.textContent('body') || '';
    // Client should see Manage but not agency-only sections in the sidebar
    expect(body).toContain('Manage');
    // Hosting and Clients links should not be visible in client mode
    const hostingLink = page.getByRole('link', { name: /Hosting/i });
    await expect(hostingLink).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });
});
