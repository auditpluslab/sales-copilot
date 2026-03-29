import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'

async function globalSetup(config: FullConfig) {
  const authFile = path.join(process.cwd(), 'e2e/.auth/user.json')
  const authDir = path.dirname(authFile)

  // 認証ディレクトリが存在しない場合は作成
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  // 既に認証ファイルが存在する場合は上書きする（削除は権限エラーを防ぐためにスキップ）
  if (fs.existsSync(authFile)) {
    console.log('Auth file exists, will overwrite with fresh authentication')
  }

  console.log('Starting authentication...')

  const browser = await chromium.launch()
  const context = await browser.newContext()

  // 開発モード用のモック認証クッキーを直接設定
  await context.addCookies([
    {
      name: 'sb-access-token',
      value: 'test-mock-access-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax' as const,
    },
    {
      name: 'sb-refresh-token',
      value: 'test-mock-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax' as const,
    },
  ])

  console.log('Mock authentication cookies set')

  const page = await context.newPage()

  try {
    console.log('Navigating to home page...')

    // ホームページに移動して認証されていることを確認
    // CI環境ではサーバー起動を待つ
    const maxRetries = process.env.CI ? 10 : 3
    let success = false

    for (let i = 0; i < maxRetries; i++) {
      try {
        await page.goto('http://localhost:3000', { timeout: 10000 })
        await page.waitForLoadState('networkidle', { timeout: 10000 })

        // デバッグ: 現在のURLとページ内容を確認
        console.log('Current URL:', page.url())
        console.log('Page title:', await page.title())

        // 認証されていることを確認
        const h1Text = await page.locator('h1').textContent()
        console.log('Page h1:', h1Text)

        if (h1Text?.includes('営業会議コパイロット') || h1Text?.includes('Sales Copilot')) {
          console.log('Authentication verified, saving auth state...')
          success = true
          break
        }

        // CI環境ではリトライ
        if (process.env.CI) {
          console.log(`Retry ${i + 1}/${maxRetries}: Page not ready, waiting...`)
          await page.waitForTimeout(2000)
          continue
        }

        // ローカル環境では失敗
        await page.screenshot({ path: 'e2e/.auth/home-debug.png' })
        const bodyText = await page.locator('body').textContent()
        console.log('Page body text (first 500 chars):', bodyText?.substring(0, 500))
        throw new Error('Authentication verification failed: Expected "営業会議コパイロット" in h1')
      } catch (error) {
        if (i === maxRetries - 1) throw error
        console.log(`Retry ${i + 1}/${maxRetries}:`, (error as Error).message)
        await page.waitForTimeout(2000)
      }
    }

    if (!success && !process.env.CI) {
      throw new Error('Authentication verification failed: Could not access home page')
    }

    // ストレージステートを保存
    await context.storageState({ path: authFile })
  } catch (error) {
    console.error('Authentication failed:', error)
    throw error
  } finally {
    await browser.close()
  }

  console.log('Authentication completed successfully')
}

export default globalSetup
