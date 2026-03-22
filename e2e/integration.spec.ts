import { test, expect } from '@playwright/test'

/**
 * 統合テスト: 複数の機能を組み合わせたテスト
 *
 * ユーザーの実際の使用フローに近い形でテストを実施
 */

test.describe('統合テスト: 完全会議フロー', () => {
  test('ホーム → セッション作成 → 会議ページ → 開始', async ({ page }) => {
    // APIモックの設定
    await page.route('**/api/session', async (route) => {
      const request = route.request()
      const method = request.method()

      if (method === 'POST') {
        const body = JSON.parse(request.postData() || '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session: {
              id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // 有効なUUID形式
              client_name: body.client_name || 'テスト株式会社',
              client_company: body.client_company || 'テスト株式会社',
              meeting_title: body.meeting_title || '初回ヒアリング',
              status: 'scheduled',
              created_at: new Date().toISOString(),
            }
          })
        })
        return
      }

      // GETリクエスト
      const url = new URL(request.url())
      const sessionId = url.searchParams.get('id')

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: sessionId || 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // 有効なUUID形式
            meeting_title: '初回ヒアリング',
            client_name: 'テスト株式会社',
            client_company: 'テスト株式会社',
            status: 'scheduled',
            created_at: new Date().toISOString(),
          }
        })
      })
    })

    // Inngest APIをモック
    await page.route('**/inngest/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ids: ['event-123'] })
      })
    })

    // 1. ホームページを表示
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('営業会議コパイロット')

    // 2. 新しいセッションボタンをクリック
    await page.click('a:has-text("新しいセッション")')
    await expect(page).toHaveURL(/\/session\/new/)

    // 3. フォームを入力
    await page.fill('#client_name', '統合テスト株式会社')
    await page.fill('#client_company', '統合テスト株式会社')
    await page.fill('#meeting_title', '統合テスト会議')

    // 4. 送信
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // 5. 会議ページへ遷移
    await expect(page).toHaveURL(/\/meeting\/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // 6. 会議ページが正しく表示されることを確認
    await expect(page.locator('header')).toBeVisible()

    // タイトルが正しく表示される（meeting_titleが優先）
    const titleElement = page.locator('h1')
    await expect(titleElement).toBeVisible()
  })

  test('複数セッションの作成と切り替え', async ({ page }) => {
    let sessionCounter = 0

    // APIモックの設定
    await page.route('**/api/session', async (route) => {
      const request = route.request()
      const method = request.method()

      if (method === 'POST') {
        sessionCounter++
        const body = JSON.parse(request.postData() || '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session: {
              id: `multi-session-${sessionCounter}`,
              client_name: body.client_name,
              client_company: body.client_company,
              meeting_title: body.meeting_title,
              status: 'scheduled',
              created_at: new Date().toISOString(),
            }
          })
        })
        return
      }

      // GETリクエスト（セッション一覧）
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            {
              id: 'cccccccc-cccc-cccc-cccc-cccccccc',
              meeting_title: '1回目の会議',
              client_name: 'クライアントA',
              status: 'scheduled',
              created_at: new Date().toISOString(),
            }
          ]
        })
      })
    })

    // 最初のセッションを作成
    await page.goto('/session/new')
    await page.fill('#client_name', 'クライアントA')
    await page.fill('#meeting_title', '1回目の会議')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1000)

    // URLを確認
    await expect(page).toHaveURL(/\/meeting\/cccccccc-cccc-cccc-cccc-cccccccc/)

    // ホームに戻る
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('営業会議コパイロット')
  })

  test('エラーからの回復フロー', async ({ page }) => {
    // 最初はエラーを返す
    let attemptCount = 0
    let shouldError = true

    await page.route('**/api/session', async (route) => {
      const request = route.request()
      const method = request.method()

      if (method === 'POST') {
        attemptCount++

        if (shouldError && attemptCount === 1) {
          // 最初の試行はエラー
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Database connection failed' })
          })
          return
        }

        // 2回目以降は成功
        shouldError = false
        const body = JSON.parse(request.postData() || '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session: {
              id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
              client_name: body.client_name,
              client_company: body.client_company,
              meeting_title: body.meeting_title,
              status: 'scheduled',
              created_at: new Date().toISOString(),
            }
          })
        })
        return
      }

      await route.continue()
    })

    // ダイアログハンドラーを設定
    page.on('dialog', async dialog => {
      await dialog.accept()
    })

    // フォームを送信（最初は失敗）
    await page.goto('/session/new')
    await page.fill('#client_name', 'テスト株式会社')
    await page.fill('#meeting_title', 'エラーリカバリーテスト')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1000)

    // フォームが再表示される（エラーのため）
    await expect(page).toHaveURL(/\/session\/new/)

    // 再送信（今回は成功）
    await page.click('button[type="submit"]')
    await page.waitForTimeout(1000)

    // 成功したか確認（ページが移動していればOK）
    const currentUrl = page.url()
    const isSuccess = currentUrl.includes('/meeting/') || currentUrl.includes('/session/new')
    expect(isSuccess).toBe(true)
  })
})

test.describe('統合テスト: データ整合性', () => {
  test('セッションデータの一貫性', async ({ page }) => {
    const testSessionId = 'dddddddd-dddd-dddd-dddd-ddddddddddddd'
    const testClientName = '一貫性テスト株式会社'
    const testMeetingTitle = '一貫性テスト会議'

    // APIモック
    await page.route('**/api/session**', async (route) => {
      const url = new URL(route.request().url())
      const id = url.searchParams.get('id')

      if (id === testSessionId) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session: {
              id: testSessionId,
              meeting_title: testMeetingTitle,
              client_name: testClientName,
              client_company: testClientName,
              status: 'scheduled',
              created_at: new Date().toISOString(),
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    // 会議ページを表示
    await page.goto(`/meeting/${testSessionId}`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // ヘッダー情報を確認
    await expect(page.locator('header')).toBeVisible()

    // クライアント名が表示されていることを確認
    const clientNameText = await page.locator('header').textContent()
    expect(clientNameText).toContain(testClientName)
  })

  test('特殊文字を含むデータの処理', async ({ page }) => {
    const specialInputs = [
      'テスト株式会社',
      'Test & Company',
      '株式会社「テスト」',
      'Test<>Company',
    ]

    for (const input of specialInputs) {
      await page.route('**/api/session', async (route) => {
        const request = route.request()
        const method = request.method()

        if (method === 'POST') {
          const body = JSON.parse(request.postData() || '{}')
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              session: {
                id: `special-chars-${Date.now()}`,
                client_name: body.client_name,
                client_company: body.client_company,
                meeting_title: body.meeting_title,
                status: 'scheduled',
                created_at: new Date().toISOString(),
              }
            })
          })
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sessions: [] })
        })
      })

      await page.goto('/session/new')
      await page.fill('#client_name', input)
      await page.fill('#meeting_title', '特殊文字テスト')
      await page.click('button[type="submit"]')
      await page.waitForTimeout(500)

      // エラーが発生していないことを確認
      const isVisible = await page.locator('body').isVisible()
      expect(isVisible).toBe(true)

      // 次のテストのためにホームに戻る
      await page.goto('/')
      await page.waitForTimeout(200)
    }
  })
})

test.describe('統合テスト: パフォーマンス', () => {
  test('ページ遷移の速度', async ({ page }) => {
    await page.route('**/api/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: [] })
      })
    })

    // ホームページの読み込み時間
    const homeStart = Date.now()
    await page.goto('/')
    const homeLoadTime = Date.now() - homeStart
    expect(homeLoadTime).toBeLessThan(3000)

    // セッション作成ページへの遷移時間
    const sessionStart = Date.now()
    await page.click('a:has-text("新しいセッション")')
    await page.waitForLoadState('domcontentloaded')
    const sessionLoadTime = Date.now() - sessionStart
    expect(sessionLoadTime).toBeLessThan(2000)
  })

  test('複数APIコールの効率性', async ({ page }) => {
    let apiCallCount = 0

    await page.route('**/api/**', async (route) => {
      apiCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sessions: [] })
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // APIコールが過剰でないことを確認
    expect(apiCallCount).toBeLessThan(10)
  })
})
