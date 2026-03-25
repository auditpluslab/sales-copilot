import { test, expect } from "./fixtures/auth"

test.describe('認証済み: セッション作成', () => {
  test.beforeEach(async ({ page }) => {
    // DevTools関連のエラーを無視
    page.on('pageerror', error => {
      // Next.js DevToolsのエラーを無視
      if (error.message.includes('appendChild') ||
          error.message.includes('DevTools') ||
          error.message.includes('nextjs') ||
          error.message.includes('reading')) {
        return
      }
      console.error('Browser Error:', error.message)
    })
  })

  test('新しいセッションを作成できる', async ({ page }) => {
    await page.goto('http://localhost:3000/session/new')

    // フォームが表示されるのを待つ
    await page.waitForSelector('form', { timeout: 5000 })

    // フォームを入力
    await page.fill('#client_name', 'テストクライアント')
    await page.fill('#client_company', 'テストカンパニー')
    await page.fill('#meeting_title', 'テスト会議')

    // CSRFトークンを取得
    const csrfResponse = await page.request.get('http://localhost:3000/api/auth/csrf')
    const csrfData = await csrfResponse.json()
    const csrfToken = csrfData.csrf_token

    // フォームを送信
    const submitButton = page.locator('form button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await submitButton.click()

    // 会議ページに遷移することを確認
    await page.waitForURL(/\/meeting\/[a-f0-9-]+/, { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    expect(page.url()).toMatch(/\/meeting\/[a-f0-9-]+/)
  })
})

test.describe('認証済み: セキュリティ', () => {
  test('CSRFトークンなしでPOSTリクエストを送信すると403になる', async ({ page }) => {
    const response = await page.request.post('http://localhost:3000/api/session', {
      data: {
        client_name: 'テスト',
        meeting_title: 'テスト会議',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.status()).toBe(403)
  })

  test('CSRFトークンありでPOSTリクエストを送信すると成功する', async ({ page }) => {
    // ページコンテキストでCSRFトークンを取得（クッキーを含めるため）
    const csrfToken = await page.evaluate(async () => {
      const response = await fetch('http://localhost:3000/api/auth/csrf')
      const data = await response.json()
      return data.csrf_token
    })

    // ページコンテキストでPOSTリクエストを送信
    const result = await page.evaluate(async ({ clientName, meetingTitle, token }) => {
      const response = await fetch('http://localhost:3000/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({
          client_name: clientName,
          meeting_title: meetingTitle,
        }),
      })
      return {
        status: response.status,
        ok: response.ok,
      }
    }, { clientName: 'テスト', meetingTitle: 'テスト会議', token: csrfToken })

    expect(result.status).toBe(200)
    expect(result.ok).toBe(true)
  })
})
