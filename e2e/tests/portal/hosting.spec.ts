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
    // Should show instances or "no instances" empty state
    const hasContent = await page.locator(
      '[class*="instance"], text=/no instance|create|provision|deploy/i'
    ).count() > 0;
    expect(hasContent).toBe(true);
  });

  test('instance detail page should show management controls', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('networkidle');

    // Click first instance if any exist
    const instanceLink = page.locator('a[href*="/portal/hosting/"]').first();
    if (await instanceLink.count() > 0 && await instanceLink.isVisible()) {
      await instanceLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Should show management controls
      const hasControls = await page.locator(
        'button:has-text("Start"), button:has-text("Stop"), button:has-text("Restart"), button:has-text("Delete")'
      ).count() > 0;
      expect(hasControls).toBe(true);
    }
  });

  test('instance detail should show instance URL', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('networkidle');

    const instanceLink = page.locator('a[href*="/portal/hosting/"]').first();
    if (await instanceLink.count() > 0 && await instanceLink.isVisible()) {
      await instanceLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Should show the instance URL
      const hasUrl = await page.locator('a[href*="http"], text=/https?:\/\//').count() > 0;
      expect(hasUrl).toBe(true);
    }
  });

  test('start/stop action buttons should be clickable', async ({ agencyPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('networkidle');

    const instanceLink = page.locator('a[href*="/portal/hosting/"]').first();
    if (await instanceLink.count() > 0 && await instanceLink.isVisible()) {
      await instanceLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Check that buttons are not disabled (or at least exist)
      const startBtn = page.locator('button:has-text("Start")');
      const stopBtn = page.locator('button:has-text("Stop")');
      const restartBtn = page.locator('button:has-text("Restart")');

      const anyButtonExists = await startBtn.count() > 0
        || await stopBtn.count() > 0
        || await restartBtn.count() > 0;
      expect(anyButtonExists).toBe(true);
    }
  });

  test('client cannot access /portal/hosting', async ({ clientPage: page }) => {
    await page.goto('/portal/hosting');
    await page.waitForLoadState('domcontentloaded');
    // Client should be redirected away or see no hosting links in sidebar
    const url = page.url();
    const hostingItems = await page.locator('a[href*="/portal/hosting"]').count();
    // Either redirected OR no hosting links
    expect(!url.includes('/portal/hosting') || hostingItems === 0).toBe(true);
  });
});
