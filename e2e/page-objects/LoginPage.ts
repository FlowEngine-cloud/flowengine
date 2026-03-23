import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for the portal Auth Modal.
 * The portal uses a modal-based authentication system (same as FlowEngine).
 */
export class LoginPage {
  readonly page: Page;

  readonly authModal: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  readonly signupToggle: Locator;
  readonly signinToggle: Locator;
  readonly forgotPasswordToggle: Locator;

  readonly alertMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.authModal = page.locator('form').filter({ has: page.locator('[name="email"]') });
    this.emailInput = page.locator('[name="email"]');
    this.passwordInput = page.locator('[name="password"]');
    this.submitButton = this.authModal.locator('button[type="submit"]');
    this.signupToggle = page.getByText("Don't have an account? Sign up");
    this.signinToggle = page.getByText('Already have an account? Sign in');
    this.forgotPasswordToggle = page.getByText('Forgot password?');
    this.alertMessage = this.authModal.locator('[role="alert"]');
  }

  async openAuthModal() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');

    const signInButton = this.page.getByRole('button', { name: /Sign in|Get Started|Login/i }).first();
    if (await signInButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signInButton.click();
      await this.authModal.waitFor({ state: 'visible', timeout: 10000 });
    }
  }

  async switchToSignin() {
    if (await this.signinToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.signinToggle.click();
      await this.page.waitForTimeout(300);
    }
  }

  async login(email: string, password: string, openModal = true) {
    if (openModal) await this.openAuthModal();
    await this.switchToSignin();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();

    const modalClosed = await this.authModal
      .waitFor({ state: 'hidden', timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    if (modalClosed) {
      await this.page.waitForTimeout(2000);
      const url = this.page.url();
      if (url.endsWith('/') || url.endsWith('localhost:3001/')) {
        await this.page.goto('/portal');
        await this.page.waitForLoadState('domcontentloaded');
      }
    } else {
      await this.page.waitForTimeout(1000);
    }
  }

  async getAlertMessage(): Promise<string | null> {
    if (await this.alertMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
      return this.alertMessage.textContent();
    }
    const errorText = this.authModal.locator('text=/invalid|error|failed|incorrect/i').first();
    if (await errorText.isVisible({ timeout: 1000 }).catch(() => false)) {
      return errorText.textContent();
    }
    return null;
  }

  async isAuthenticated(): Promise<boolean> {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    const portalNav = this.page.locator('nav, [role="navigation"]').first();
    return portalNav.isVisible({ timeout: 5000 }).catch(() => false);
  }
}
