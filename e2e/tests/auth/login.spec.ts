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
    await loginPage.openAuthPage();
    await loginPage.switchToSignin();
    await loginPage.emailInput.fill('invalid@example.com');
    await loginPage.passwordInput.fill('wrongpassword');
    await loginPage.submitButton.click();
    // Should stay on /auth (not redirect to /portal)
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/auth/);
    const error = await loginPage.getAlertMessage();
    expect(error).toBeTruthy();
  });

  test('should redirect unauthenticated users from /portal to /auth', async ({ page }) => {
    await page.goto('/portal');
    await page.waitForLoadState('domcontentloaded');
    // Portal layout redirects unauthenticated users to /auth
    await expect(page).toHaveURL(/\/auth/, { timeout: 8000 });
  });

  test('/auth page renders sign-in form directly (not a modal)', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    const emailInput = page.locator('[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    const passwordInput = page.locator('[name="password"]');
    await expect(passwordInput).toBeVisible();
  });

  test('invite flow shows signup mode on /auth?invite=1', async ({ page }) => {
    await page.goto('/auth?invite=1');
    await page.waitForLoadState('domcontentloaded');
    // With invite=1, allow_signup is forced true and initialMode is signup
    // The sign-in toggle should be visible (meaning we're in signup mode)
    const signinToggle = page.getByText('Already have an account? Sign in');
    await expect(signinToggle).toBeVisible({ timeout: 5000 });
  });
});
