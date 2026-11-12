import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',outputDir:'test-results/e2e',fullyParallel:false,workers:1,retries:0,timeout:60_000,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:3117',trace:'retain-on-failure',screenshot:'only-on-failure',...devices['Desktop Chrome'],channel:process.env.PLAYWRIGHT_CHANNEL||undefined},
  webServer:{command:'npm run start -- --hostname 127.0.0.1 --port 3117',url:'http://127.0.0.1:3117',reuseExistingServer:false,timeout:60_000},
});
