import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
// `wrangler pages dev` serves dist/ with public/_headers applied like Cloudflare Pages.
const PAGES_PORT = 8788;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // iPhone 12 runs on Chromium with the iPhone viewport/UA so CI only needs one browser.
  projects: [
    { name: 'pixel5', testIgnore: /admin\.spec/, use: { ...devices['Pixel 5'] } },
    {
      name: 'iphone12',
      testIgnore: /admin\.spec/,
      use: { ...devices['iPhone 12'], browserName: 'chromium', defaultBrowserType: 'chromium' },
    },
    { name: 'desktop', testIgnore: /admin\.spec/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'headers',
      testMatch: /admin\.spec/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PAGES_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx astro preview --port ${PORT}`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npx wrangler pages dev dist --port ${PAGES_PORT}`,
      url: `http://localhost:${PAGES_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { WRANGLER_SEND_METRICS: 'false' },
    },
  ],
});
