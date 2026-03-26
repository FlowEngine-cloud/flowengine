import { test as base, Page } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { TEST_USERS } from './testData';

export type AuthFixtures = {
  agencyPage: Page;
  clientPage: Page;
};

async function loginAndNavigate(page: Page, email: string, password: string, path: string) {
  const loginPage = new LoginPage(page);
  await loginPage.login(email, password, true);
  // Wait for auth to settle, then navigate to the target path
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
}

export const test = base.extend<AuthFixtures>({
  agencyPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAndNavigate(page, TEST_USERS.agency.email, TEST_USERS.agency.password, '/portal');
    await use(page);
    await context.close();
  },

  clientPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAndNavigate(page, TEST_USERS.client.email, TEST_USERS.client.password, '/portal');
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
