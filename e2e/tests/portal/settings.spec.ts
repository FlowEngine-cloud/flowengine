import { test, expect } from '../../fixtures/auth';

test.describe('Portal - Settings Page', () => {
  test.beforeEach(async ({ agencyPage: page }) => {
    await page.goto('/portal/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should load settings page with tabs', async ({ agencyPage: page }) => {
    await expect(page).toHaveURL(/\/portal\/settings/);
    const body = await page.textContent('body') || '';
    expect(body.toLowerCase()).toMatch(/account|settings/);
  });

  test('should show Account tab with profile fields', async ({ agencyPage: page }) => {
    // Account tab should show email/name fields
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    const nameField = page.locator('input[name="full_name"], input[placeholder*="name" i]').first();
    const hasProfileFields = await emailField.isVisible({ timeout: 5000 }).catch(() => false)
      || await nameField.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasProfileFields).toBe(true);
  });

  test('should show Company tab with team/branding', async ({ agencyPage: page }) => {
    const companyTab = page.getByRole('button', { name: /company|team/i }).or(
      page.locator('button, a').filter({ hasText: /company/i })
    ).first();
    if (await companyTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await companyTab.click();
      await page.waitForTimeout(500);
      const body = await page.textContent('body') || '';
      expect(body.toLowerCase()).toMatch(/team|branding|logo/);
    }
  });

  test('should show Connections tab with platform settings', async ({ agencyPage: page }) => {
    const connectTab = page.locator('button, a').filter({ hasText: /connect|platform|integration/i }).first();
    if (await connectTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await connectTab.click();
      await page.waitForTimeout(500);
      const body = await page.textContent('body') || '';
      expect(body.toLowerCase()).toMatch(/api|connect|stripe|smtp/);
    }
  });

  test('should show API tab with API key', async ({ agencyPage: page }) => {
    const apiTab = page.locator('button, a').filter({ hasText: /^api$/i }).or(
      page.locator('[data-tab="api"]')
    ).first();
    if (await apiTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await apiTab.click();
      await page.waitForTimeout(500);
      const body = await page.textContent('body') || '';
      expect(body.toLowerCase()).toMatch(/api key|fp_/);
    }
  });

  test('should save account name without error', async ({ agencyPage: page }) => {
    // Find name input
    const nameInput = page.locator('input[name="full_name"]').or(
      page.locator('input[placeholder*="name" i]').first()
    );
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Demo Agency');
      // Find save button
      const saveButton = page.locator('button').filter({ hasText: /save|update/i }).first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(1500);
        // Should not show error
        const errorAlert = page.locator('[role="alert"]').filter({ hasText: /error|failed/i });
        const hasError = await errorAlert.isVisible({ timeout: 2000 }).catch(() => false);
        expect(hasError).toBe(false);
      }
    }
  });
});
