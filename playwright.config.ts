import { defineConfig } from '@playwright/test';

const ports = {
  api: Number(process.env.APP_PORT ?? 3201),
  web: Number(process.env.WEB_PORT ?? 4173),
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [['list']],
  outputDir: 'tmp/playwright/test-results',
  use: {
    baseURL: `http://127.0.0.1:${ports.web}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
    viewport: {
      width: 1600,
      height: 1200,
    },
  },
  webServer: [
    {
      command: 'node scripts/e2e/start-api.mjs',
      url: `http://127.0.0.1:${ports.api}/api/health/live`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `APP_PORT=${ports.api} WEB_PORT=${ports.web} pnpm --filter @cloud-driver/web exec vite --host 127.0.0.1 --port ${ports.web}`,
      url: `http://127.0.0.1:${ports.web}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
