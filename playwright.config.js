import { defineConfig, devices } from '@playwright/test';
const port=process.env.PLAYWRIGHT_TEST_PORT||'4173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['line']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iPhone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    { name: 'desktop-seo', testMatch: 'seo.spec.js', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build && node --experimental-strip-types tests/prebooking-browser-server.mjs`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
});
