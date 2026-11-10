import { defineConfig, devices } from '@playwright/test';
const port=process.env.PLAYWRIGHT_TEST_PORT||'4173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers:1,
  reporter: [['line']],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'iPhone', use: { ...devices['iPhone 13'], browserName: 'chromium',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined} } },{name:'Desktop',use:{...devices['Desktop Chrome'],launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined}}},{name:'Android',use:{...devices['Pixel 7'],browserName:'chromium',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined}}},...(process.env.HALA_WEBKIT==='1'?[{name:'Safari',use:{...devices['iPhone 13'],browserName:'webkit'}}]:[])],
  webServer: {
    command: `npm run build && node --experimental-strip-types tests/prebooking-browser-server.mjs`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1',
  },
});
