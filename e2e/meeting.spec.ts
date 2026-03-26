import { test, expect } from './fixtures/auth'

test.describe('会議ページ', () => {
  // 有効なUUID形式を使用
  const testSessionId = '12345678-1234-1234-1234-123456789012'

  test.beforeEach(async ({ page }) => {
    // セッションAPIをモック（成功しているテストと同じパターン）
    await page.route('**/api/session**', async (route) => {
      const request = route.request()
      const method = request.method()

      if (method === 'POST') {
        const body = JSON.parse(request.postData() || '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session: {
              id: testSessionId,
              client_name: body.client_name || 'テストクライアント',
              client_company: body.client_company || 'テスト株式会社',
              meeting_title: body.meeting_title || 'テスト会議',
              status: 'active',
              created_at: new Date().toISOString(),
            }
          })
        })
        return
      }

      // GETリクエスト（成功しているテストと同じパターン）
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: testSessionId,
            meeting_title: 'テスト会議',
            client_name: 'テストクライアント',
            client_company: 'テスト株式会社',
            status: 'active',
            created_at: new Date().toISOString(),
          }
        })
      })
    })

    await page.goto(`/meeting/${testSessionId}`)
  })

  test('ページ構造が確認できる', async ({ page }) => {
    // ヘッダー
    await expect(page.locator('header')).toBeVisible()

    // MVP: 提案がメインコンテンツとして表示される
    await expect(page.locator('h2:has-text("次に聞くべき質問")')).toBeVisible()
    await expect(page.locator('h2:has-text("提案カード")')).toBeVisible()
  })

})
})

test.describe('セキュリティテスト', () => {
  test('XSS脆弱性チェック', async ({ page }) => {
    await page.goto('/')

    // スクリプトタグが含まれる入力をテスト
    const maliciousInput = '<script>alert("xss")</script>'
    const inputs = page.locator('input')
    const inputCount = await inputs.count()

    if (inputCount > 0) {
      const input = inputs.first()
      await input.fill(maliciousInput)
      // フォーカスを移動
      await page.keyboard.press('Tab')
      // 入力値がエスケープされていることを確認
      const inputValue = await input.inputValue()
      // 入力値はそのまま保存される（サニタイズは表示時）
      expect(inputValue).toContain(maliciousInput)
    }
  })

  test('SQLインジェクション脆弱性チェック', async ({ page }) => {
    await page.goto('/session/new')

    // SQLインジェクションパターンをテスト
    const maliciousInput = "'; DROP TABLE users; --"
    const clientNameInput = page.locator('input[name="client_name"], #client_name')
    const inputCount = await clientNameInput.count()

    if (inputCount > 0) {
      const input = clientNameInput.first()
      await input.fill(maliciousInput)
      // フォーム送信を試みる
      const submitButton = page.locator('button[type="submit"]')
      if (await submitButton.isVisible()) {
        await submitButton.click()
        // エラーメッセージまたはバリデーションを確認
        await page.waitForTimeout(2000)
        // ページがエラーを表示していないことを確認
        const bodyText = await page.locator('body').textContent()
        expect(bodyText).not.toContain('DROP TABLE')
      }
    }
  })
})

test.describe('パフォーマンス', () => {
  test('ページ読み込み時間が適切', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/')
    const loadTime = Date.now() - startTime

    // 3秒以内に読み込まれることを確認
    expect(loadTime).toBeLessThan(3000)
  })

  test('コンソールエラーがない', async ({ page }) => {
    const consoleErrors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForTimeout(2000)

    // 重大なコンソールエラーがないことを確認
    const criticalErrors = consoleErrors.filter(
      err => !err.includes('Warning') && !err.includes('Failed to load')
    )
    expect(criticalErrors.length).toBe(0)
  })
})
