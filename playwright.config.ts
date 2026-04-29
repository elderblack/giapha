import { defineConfig, devices } from '@playwright/test'

/** Cổng dev (khớp vite mặc định 5173: PLAYWRIGHT_DEV_PORT=5173) */
const host = '127.0.0.1'
const port = process.env.PLAYWRIGHT_DEV_PORT ?? '5179'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'line' : 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm --filter web exec vite --host ${host} --port ${port}`,
    url: `http://${host}:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
