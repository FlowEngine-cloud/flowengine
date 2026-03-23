import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';
import { TEST_USERS } from '../../fixtures/testData';

test.describe('Authentication - Login', () => {
  test('should login as agency user and land on portal', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.agency.email, TEST_USERS.agency.password);
    await expect(page).toHaveURL(/\/portal/);
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should login as client user and land on portal', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.login(TEST_USERS.client.email, TEST_USERS.client.password);
    await expect(page).toHaveURL(/\/portal/);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.openAuthModal();
    await loginPage.login('invalid@example.com', 'wrongpassword', false);
    const error = await loginPage.getAlertMessage();
    expect(error).toBeTruthy();
  });

  test('should redirect unauthenticated users away from /portal', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('domcontentloaded');
    // Should either redirect to auth or show auth modal
    const url = page.url();
    const hasModal = await page.locator('[name="email"]').isVisible({ timeout: 5000 }).catch(() => false);
    expect(url.includes('/portal') === false || hasModal).toBe(true);
  });
});
