import { defineConfig, devices } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    // ['html', { open: 'never' }],  // Disable HTML reporter to avoid file write issues
  ],

  // グローバルセットアップで認証を実行
  globalSetup: path.join(__dirname, 'e2e', 'global-setup.ts'),

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 認証済みのストレージステートを使用
    storageState: path.join(__dirname, 'e2e', '.auth', 'user.json'),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 開発モードのDevToolsオーバーレイを無効化して本番環境相当のテストを実行
        ignoreDefaultArgs: ['--enable-automation'],
        args: ['--disable-dev-shm-usage'],
      },
    },
  ],
  // webServer: {
  //   command: 'npx next dev --port 3000',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: true,
  //   timeout: 120 * 1000,
  // },
})
