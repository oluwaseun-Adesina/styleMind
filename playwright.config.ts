import { defineConfig, devices } from '@playwright/test';

// E2E smoke tests for the web app. The web dev server is started automatically.
// The login screen renders without a backend, so this smoke test needs only the
// frontend. Fuller flows (login → daily pick) require the backend + a database.
const PORT = process.env.E2E_PORT || 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx vite --config apps/web/vite.config.ts --port=${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
