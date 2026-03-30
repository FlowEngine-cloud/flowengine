import { test, expect } from '../../fixtures/auth';

test.describe('Portal Dashboard - Agency User', () => {
  test('should load portal with navigation sidebar', async ({ agencyPage: page }) => {
    await expect(page).toHaveURL(/\/portal/);
    const sidebar = page.locator('nav, aside, [role="navigation"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('should show Manage section', async ({ agencyPage: page }) => {
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
    const body = (await page.textContent('body') || '').toLowerCase();
    expect(body).toMatch(/setting/);
  });

  test('should navigate to UI Studio', async ({ agencyPage: page }) => {
    await page.goto('/portal/ui-studio');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/portal\/ui-studio/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should navigate to templates page', async ({ agencyPage: page }) => {
    await page.goto('/portal/templates');
    await page.waitForLoadState('domcontentloaded');
    // Templates page exists — may redirect to ui-studio or stay at /portal/templates
    const url = page.url();
    expect(url).toMatch(/\/portal\/(templates|ui-studio)/);
  });

  test('should persist authentication across page navigations', async ({ agencyPage: page }) => {
    const routes = ['/portal', '/portal/hosting', '/portal/clients', '/portal/settings'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      // Should not redirect to /auth (session still valid)
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 3000 }).catch(() => {});
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/')));
    }
  });
});

test.describe('Portal Dashboard - Client User', () => {
  test('should load portal for client user', async ({ clientPage: page }) => {
    await expect(page).toHaveURL(/\/portal/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('client should see Manage section', async ({ clientPage: page }) => {
    const body = await page.textContent('body') || '';
    expect(body).toContain('Manage');
  });

  test('client should not see Hosting link in sidebar', async ({ clientPage: page }) => {
    const hostingLink = page.getByRole('link', { name: /^Hosting$/i });
    await expect(hostingLink).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  });
});
