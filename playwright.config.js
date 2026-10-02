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
  projects: [{ name: 'iPhone', use: { ...devices['iPhone 13'], browserName: 'chromium' } }],
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
