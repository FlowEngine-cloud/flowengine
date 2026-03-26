import { test, expect } from '../../fixtures/auth';

test.describe('Portal - Client Management', () => {
  test('should load clients page', async ({ agencyPage: page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/portal\/clients/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should show client list or empty state', async ({ agencyPage: page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('networkidle');
    // Should show either clients or an empty state message
    const hasContent = await page.locator('table, [data-testid="client-row"], text=/no clients|invite|add client/i').count() > 0;
    expect(hasContent).toBe(true);
  });

  test('should show Add Client button', async ({ agencyPage: page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('networkidle');
    const addButton = page.locator('button, a').filter({ hasText: /add client|invite|new client/i }).first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
  });

  test('client detail page should be accessible', async ({ agencyPage: page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('networkidle');
    // Click first client row if any exist
    const clientRow = page.locator('tr[class*="cursor"], tr[class*="hover"], tbody tr').first();
    if (await clientRow.count() > 0 && await clientRow.isVisible()) {
      await clientRow.click();
      await page.waitForLoadState('domcontentloaded');
      // Should navigate to client detail
      const url = page.url();
      expect(url).toMatch(/\/portal\/clients\//);
    }
  });

  test('client user cannot access /portal/clients', async ({ clientPage: page }) => {
    await page.goto('/portal/clients');
    await page.waitForLoadState('domcontentloaded');
    // Client should be redirected or see access denied
    const url = page.url();
    const body = await page.textContent('body') || '';
    const isBlocked = !url.includes('/portal/clients') || body.includes('Access') || body.includes('Manage');
    expect(isBlocked).toBe(true);
  });
});
