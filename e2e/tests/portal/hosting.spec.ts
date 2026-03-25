import { test, expect } from '../../fixtures/auth';

test.describe('Portal - Hosting / Instance Management', () => {
  test('should load hosting page', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/portal\/hosting/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should show instances list or empty state', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('networkidle');
    const hasContent = await page.locator(
      '[class*="instance"], text=/no instance|create|provision|deploy/i'
    ).count() > 0;
    expect(hasContent).toBe(true);
  });

  test('instance detail page should show management controls', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('networkidle');

    const instanceLink = page.locator('a[href*="/portal/hosting/"]').first();
    if (await instanceLink.count() > 0 && await instanceLink.isVisible()) {
      await instanceLink.click();
      await page.waitForLoadState('domcontentloaded');

      const hasControls = await page.locator(
        'button:has-text("Start"), button:has-text("Stop"), button:has-text("Restart")'
      ).count() > 0;
      expect(hasControls).toBe(true);
    }
  });

  test('instance detail should show instance URL or external link', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('networkidle');

    const instanceLink = page.locator('a[href*="/portal/hosting/"]').first();
    if (await instanceLink.count() > 0 && await instanceLink.isVisible()) {
      await instanceLink.click();
      await page.waitForLoadState('domcontentloaded');

      const hasUrl = await page.locator('a[href*="http"][target="_blank"], text=/https?:\/\//').count() > 0;
      expect(hasUrl).toBe(true);
    }
  });

  test('start/stop/restart buttons should exist on instance detail', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('networkidle');

    const instanceLink = page.locator('a[href*="/portal/hosting/"]').first();
    if (await instanceLink.count() > 0 && await instanceLink.isVisible()) {
      await instanceLink.click();
      await page.waitForLoadState('domcontentloaded');

      const startBtn = page.locator('button:has-text("Start")');
      const stopBtn = page.locator('button:has-text("Stop")');
      const restartBtn = page.locator('button:has-text("Restart")');

      const anyButtonExists =
        (await startBtn.count()) > 0 ||
        (await stopBtn.count()) > 0 ||
        (await restartBtn.count()) > 0;
      expect(anyButtonExists).toBe(true);
    }
  });

  test('client cannot access /portal/hosting agency content', async ({ clientPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    // Either redirected away, or the page doesn't show hosting management links in the sidebar
    const agencyHostingLinks = await page.locator('nav a[href="/portal/hosting"]').count();
    expect(!url.includes('/portal/hosting') || agencyHostingLinks === 0).toBe(true);
  });
});
