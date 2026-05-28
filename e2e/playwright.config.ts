import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  use: { baseURL: 'http://localhost:4173', headless: true },
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
