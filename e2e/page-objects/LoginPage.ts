import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for portal authentication.
 * The OSS portal uses a dedicated /auth page (not a modal).
 */
export class LoginPage {
  readonly page: Page;

  readonly authForm: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  readonly signupToggle: Locator;
  readonly signinToggle: Locator;
  readonly forgotPasswordToggle: Locator;

  readonly alertMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.authForm = page.locator('form').filter({ has: page.locator('[name="email"]') });
    this.emailInput = page.locator('[name="email"]');
    this.passwordInput = page.locator('[name="password"]');
    this.submitButton = this.authForm.locator('button[type="submit"]');
    this.signupToggle = page.getByText("Don't have an account? Sign up");
    this.signinToggle = page.getByText('Already have an account? Sign in');
    this.forgotPasswordToggle = page.getByText('Forgot password?');
    this.alertMessage = this.authForm.locator('[role="alert"]');
  }

  /** Navigate to the /auth page and wait for the form to be ready. */
  async openAuthPage() {
    await this.page.goto('/auth');
    await this.authForm.waitFor({ state: 'visible', timeout: 10000 });
  }

  /** @deprecated Use openAuthPage() — modal pattern no longer applies. */
  async openAuthModal() {
    await this.openAuthPage();
  }

  async switchToSignin() {
    if (await this.signinToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.signinToggle.click();
      await this.page.waitForTimeout(300);
    }
  }

  async switchToSignup() {
    if (await this.signupToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.signupToggle.click();
      await this.page.waitForTimeout(300);
    }
  }

  async login(email: string, password: string, openPage = true) {
    if (openPage) await this.openAuthPage();
    await this.switchToSignin();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();

    // After successful login, the form disappears and we're redirected to /portal
    const redirected = await this.page
      .waitForURL(/\/portal/, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (!redirected) {
      // Login may have failed (wrong credentials) — wait for error to appear
      await this.page.waitForTimeout(1000);
    }
  }

  async getAlertMessage(): Promise<string | null> {
    if (await this.alertMessage.isVisible({ timeout: 3000 }).catch(() => false)) {
      return this.alertMessage.textContent();
    }
    const errorText = this.authForm.locator('text=/invalid|error|failed|incorrect/i').first();
    if (await errorText.isVisible({ timeout: 1000 }).catch(() => false)) {
      return errorText.textContent();
    }
    // Supabase auth errors may appear as paragraph text
    const paraError = this.page.locator('p').filter({ hasText: /invalid|incorrect|credentials/i }).first();
    if (await paraError.isVisible({ timeout: 1000 }).catch(() => false)) {
      return paraError.textContent();
    }
    return null;
  }

  async isAuthenticated(): Promise<boolean> {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const portalNav = this.page.locator('nav, [role="navigation"]').first();
    return portalNav.isVisible({ timeout: 5000 }).catch(() => false);
  }
}
