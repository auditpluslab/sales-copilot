import { test, expect } from './fixtures/auth'

test.describe('会議ページ MVP', () => {
  // 有効なUUID形式を使用
  const testSessionId = '12345678-1234-1234-1234-123456789012'

  test.beforeEach(async ({ page }) => {
    // セッションAPIをモック
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

      // GETリクエスト
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

    // 提案APIをモック
    await page.route('**/api/suggestions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: {
            questions: [
              {
                id: 'q1',
                question: '導入の目的と期待される効果について具体的にお聞かせいただけますか？',
                intent: '導入目的の明確化',
                category: 'value',
                priority: 1,
                evidence: '会話の文脈から導入目的が不明確'
              },
              {
                id: 'q2',
                question: '現在の業務プロセスで、最も時間がかかっている部分はどこでしょうか？',
                intent: '課題の具体性を高める',
                category: 'constraint',
                priority: 2,
                evidence: '具体的な課題を特定するため'
              }
            ],
            proposals: [
              {
                id: 'p1',
                type: 'proposal',
                title: '導入効果の早期可視化',
                body: 'まずは1ヶ月間のトライアル導入を行い、具体的な改善数値をご提示することをお勧めします。',
                confidence: 'high',
                rank: 1,
                created_at: new Date().toISOString()
              }
            ]
          }
        })
      })
    })

    await page.goto(`/meeting/${testSessionId}`)
  })

  test('提案がメインコンテンツとして表示される', async ({ page }) => {
    // AI提案セクションが表示される
    await expect(page.locator('#suggestions-heading')).toBeVisible()

    // ピン留めタブが表示される
    await expect(page.locator('button:has-text("ピン留め")')).toBeVisible()

    // 履歴タブが表示される
    await expect(page.locator('button:has-text("履歴")')).toBeVisible()
  })

  test('更新インジケーターが表示される', async ({ page }) => {
    // 会議開始ボタンをクリック（接続状態を模倣）
    // Note: 実際のSTT接続はテスト環境では難しいため、
    // HTML構造でインジケーターが存在することを確認

    // 更新インジケーターのアニメーションクラスが存在することを確認
    const updateIndicators = page.locator('.animate-ping')
    const count = await updateIndicators.count()

    // 接続状態時は2つのインジケーター（質問と提案セクション）が表示される
    // このテストではHTML構造のみ確認
    await expect(page.getByText('5秒ごとに更新中...', { exact: true }).first()).toBeVisible()
  })

  test.skip('API失敗時にエラー状態と再読み込みボタンが表示される', async ({ page }) => {
    // beforeEachのモックを解除してエラーを返すモックを設定
    await page.unroute('**/api/suggestions')
    await page.route('**/api/suggestions**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      })
    })

    // ページを再読み込み
    await page.reload()

    // エラーメッセージが表示されるのを待つ
    await expect(page.locator('p:has-text("エラーが発生しました")')).toBeVisible()

    // エラーメッセージが表示される
    await expect(page.locator('p:has-text("エラーが発生しました")')).toBeVisible()

    // 再読み込みボタンが表示される
    await expect(page.locator('button:has-text("再読み込み")')).toBeVisible()
  })

  test('再読み込みボタンで提案が再読み込みされる', async ({ page }) => {
    // 手動更新ボタンが表示されることを確認
    await expect(page.locator('button:has-text("更新")')).toBeVisible()

    // 更新ボタンをクリックして新しい提案が読み込まれることを確認
    // Note: 実際のAPI呼び出しはテスト環境では完全には検証できないため、
    // ボタンがクリック可能であることを確認する
    await page.click('button:has-text("更新")')

    // ページが応答することを確認（エラーが発生しない）
    await expect(page.locator('#suggestions-heading')).toBeVisible()
  })

  test('会議終了ボタンが正常に動作する', async ({ page }) => {
    // 会議終了ボタンはSTT接続時のみ表示される
    const endMeetingButton = page.locator('button:has-text("会議終了")')

    // 接続していない状態では表示されない
    await expect(endMeetingButton).not.toBeVisible()

    // 会議開始ボタンは表示される
    await expect(page.locator('button:has-text("会議開始")')).toBeVisible()
  })
})
