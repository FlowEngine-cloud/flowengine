/**
 * Test user credentials.
 * Set via environment variables or use demo defaults.
 */
export const TEST_USERS = {
  agency: {
    email: process.env.E2E_AGENCY_EMAIL || 'admin@demo.com',
    password: process.env.E2E_AGENCY_PASSWORD || 'Test123!',
  },
  client: {
    email: process.env.E2E_CLIENT_EMAIL || 'client@demo.com',
    password: process.env.E2E_CLIENT_PASSWORD || 'Test123!',
  },
};
