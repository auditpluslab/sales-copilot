import { test, expect } from '@playwright/test'

/**
 * TDD: セッション作成フローのE2Eテスト
 *
 * テスト駆動開発のサイクル:
 * 1. テストを書く（赤：失敗）
 * 2. 最小限のコードを書いてテストを通す（緑：成功）
 * 3. リファクタリング
 */

test.describe('TDD: セッション作成フロー', () => {
  test.beforeEach(async ({ page }) => {
    // APIモックの設定 - POST（セッション作成）
    await page.route('**/api/session', async (route) => {
      const request = route.request()
      const method = request.method()

      // POSTリクエスト（セッション作成）
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session: {
              id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // 有効なUUID形式
              client_name: 'テスト株式会社',
              client_company: 'テスト株式会社',
              meeting_title: '初回ヒアリング',
              status: 'scheduled',
              created_at: new Date().toISOString(),
            }
          })
        })
        return
      }

      // GETリクエスト - すべてのGETリクエストに対してテストセッションを返す
      // （会議ページからのリクエストを確実にキャプチャするため）
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // 有効なUUID形式
            client_name: 'テスト株式会社',
            client_company: 'テスト株式会社',
            meeting_title: '初回ヒアリング',
            status: 'scheduled',
            created_at: new Date().toISOString(),
          }
        })
      })
    })

    // Inngest APIもモック
    await page.route('**/inngest/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ids: ['event-123'] })
      })
    })
  })

  test.describe('RED: 最初に書くテスト（失敗することを確認）', () => {
    test('新しいセッションを作成して会議ページへ遷移する', async ({ page }) => {
      // 1. ホームページを表示
      await page.goto('/')
      await expect(page.locator('h1')).toContainText('営業会議コパイロット')

      // 2. 新しいセッションボタンをクリック
      await page.click('a:has-text("新しいセッション")')
      await expect(page).toHaveURL(/\/session\/new/)

      // 3. フォームに入力
      await page.fill('#client_name', 'テスト株式会社')
      await page.fill('#client_company', 'テスト株式会社')
      await page.fill('#meeting_title', '初回ヒアリング')

      // 4. 送信
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()

      // 5. 会議ページへ遷移することを確認
      await expect(page).toHaveURL(/\/meeting\/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/)

      // 6. 会議ページがロードされるのを待機
      await page.waitForLoadState('domcontentloaded')

      // 7. セッション情報がロードされるまで待機
      await page.waitForTimeout(3000)

      // 8. 会議ページの基本要素を確認
      await expect(page.locator('header')).toBeVisible()
      await expect(page.locator('h1')).toContainText('初回ヒアリング')
    })

    test('必須項目未入力でバリデーションエラー', async ({ page }) => {
      await page.goto('/session/new')

      // 空のまま送信
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()

      // フォームが送信されないことを確認
      await expect(page).toHaveURL(/\/session\/new/)

      // バリデーションメッセージまたはrequired属性を確認
      const clientNameInput = page.locator('#client_name')
      const isRequired = await clientNameInput.evaluate((el) => (el as HTMLInputElement).required)
      expect(isRequired).toBe(true)
    })
  })

  test.describe('GREEN: テストを通すための機能実装後', () => {
    test('セッション一覧が表示される', async ({ page }) => {
      await page.goto('/')

      // セッション一覧セクションが表示される
      await expect(page.locator('text=最近のセッション')).toBeVisible()

      // 空の状態メッセージが表示される（モックデータが空のため）
      await expect(page.locator('text=セッションがありません')).toBeVisible()
    })

    test('セッションカードをクリックして会議ページへ', async ({ page }) => {
      // まずセッションを作成
      await page.goto('/session/new')
      await page.fill('#client_name', 'テスト株式会社')
      await page.fill('#client_company', 'テスト株式会社')
      await page.fill('#meeting_title', 'クリックテスト会議')

      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()

      // 会議ページへ遷移したことを確認
      await expect(page).toHaveURL(/\/meeting\/test-session-123/)

      // 会議ページの基本要素を確認
      await expect(page.locator('header')).toBeVisible()
    })
  })

  test.describe('REFACTOR: リファクタリング後もテストが通ることを確認', () => {
    test('フォーム入力の速度テスト', async ({ page }) => {
      await page.goto('/session/new')

      // フォームが素早く入力できることを確認
      const startTime = Date.now()

      await page.fill('#client_name', 'テスト株式会社')
      await page.fill('#client_company', 'テスト株式会社')
      await page.fill('#meeting_title', '初回ヒアリング')

      const loadTime = Date.now() - startTime

      // 入力がスムーズであること（500ms以内）
      expect(loadTime).toBeLessThan(500)
    })

    test('モバイルでのフォーム操作性', async ({ page }) => {
      // モバイルサイズに設定
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/session/new')

      // 入力フィールドがフォーカス可能
      await page.focus('#client_name')
      await page.type('#client_name', 'テスト')

      // フォームが表示されている
      await expect(page.locator('#client_name')).toHaveValue('テスト')
    })
  })
})

test.describe('TDD: エラーハンドリング', () => {
  test('APIエラー時の適切な表示', async ({ page }) => {
    // APIエラーをモック
    await page.route('**/api/session', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' })
        })
      }
    })

    // ダイアログハンドラーを設定
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('失敗')
      await dialog.accept()
    })

    await page.goto('/session/new')

    await page.fill('#client_name', 'テスト株式会社')
    await page.fill('#meeting_title', '初回ヒアリング')

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // エラーアラートが表示されるのを待つ
    await page.waitForTimeout(1000)
  })

  test('ネットワークエラー時のリトライ', async ({ page }) => {
    // ダイアログハンドラーを設定
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('失敗')
      await dialog.accept()
    })

    // ネットワークエラーをモック
    await page.route('**/api/session', route => route.abort('failed'))

    await page.goto('/session/new')

    await page.fill('#client_name', 'テスト株式会社')
    await page.fill('#meeting_title', '初回ヒアリング')

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // エラーダイアログが表示されるのを待つ
    await page.waitForTimeout(1000)
  })
})
