import { defineConfig, devices } from '@playwright/test';

// Runs against the full stack (web + api + worker + mongo + redis) already
// running — see README.md for how to bring it up before `npm test` here.
// Deliberately does NOT use Playwright's `webServer` option: this stack is
// five separate processes, not one command.
export default defineConfig({
  testDir: './specs',
  fullyParallel: false, // tests share one seeded user/dataset per file; keep it simple and deterministic
  // The auth endpoints are rate-limited (20 req/15min/IP) against real
  // credential-stuffing — running spec files in parallel multiplies
  // register/login calls against that shared limit for no benefit here.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
