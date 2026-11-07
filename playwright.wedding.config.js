import {defineConfig,devices} from '@playwright/test';
import base from './playwright.config.js';
const webkitOptions=process.env.HALA_TEST_WEBKIT_EXECUTABLE?{launchOptions:{executablePath:process.env.HALA_TEST_WEBKIT_EXECUTABLE}}:{};
export default defineConfig({
  ...base,outputDir:'test-results/wedding',testMatch:'**/wedding-v2.spec.js',testIgnore:[],timeout:60000,workers:2,
  projects:[
    {name:'Desktop-Chromium',use:{...devices['Desktop Chrome'],browserName:'chromium'}},
    {name:'Android-Chromium',use:{...devices['Pixel 7'],browserName:'chromium'}},
    ...(!process.env.SKIP_WEBKIT?[
      {name:'iPhone-WebKit',use:{...devices['iPhone 13'],browserName:'webkit',...webkitOptions}},
      {name:'Desktop-WebKit',use:{...devices['Desktop Safari'],browserName:'webkit',...webkitOptions}},
    ]:[]),
  ],
});
