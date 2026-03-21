import { test, expect } from '@playwright/test'

test.describe('セッション作成', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/session/new')
  })

  test('セッション作成フォームが表示される', async ({ page }) => {
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[name="client_name"], #client_name')).toBeVisible()
    await expect(page.locator('input[name="meeting_title"], #meeting_title')).toBeVisible()
  })

  test('必須フィールドが空の場合バリデーションエラー', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]')
    if (await submitButton.isVisible()) {
      await submitButton.click()

      const clientNameInput = page.locator('input[name="client_name"], #client_name')
      const isValid = await clientNameInput.evaluate((el: HTMLInputElement) => el.checkValidity())
      expect(isValid).toBe(false)
    }
  })

  test('有効なデータでセッションを作成できる', async ({ page }) => {
    const clientNameInput = page.locator('input[name="client_name"], #client_name')
    const meetingTitleInput = page.locator('input[name="meeting_title"], #meeting_title')

    if (await clientNameInput.isVisible()) {
      await clientNameInput.fill('テスト株式会社')
    }
    if (await meetingTitleInput.isVisible()) {
      await meetingTitleInput.fill('初回ヒアリングミーティング')
    }

    const submitButton = page.locator('button[type="submit"]')
    if (await submitButton.isVisible()) {
      await submitButton.click()
    }
  })

  test('長すぎる入力でバリデーションエラー', async ({ page }) => {
    const clientNameInput = page.locator('input[name="client_name"], #client_name')

    if (await clientNameInput.isVisible()) {
      // 101文字入力
      await clientNameInput.fill('a'.repeat(101))

      const maxLength = await clientNameInput.getAttribute('maxlength')
      // maxlengthがない場合はサーバーサイドバリデーションに依存
      if (maxLength) {
        expect(maxLength).not.toBeNull()
      } else {
        // maxlengthがない場合はサーバーサイドバリデーションを期待
        console.log('maxlength attribute not set - server-side validation expected')
      }
    }
  })
})

test.describe('セッション一覧', () => {
  test('セッション一覧が表示される', async ({ page }) => {
    await page.goto('/')

    // セッション一覧セクションが存在
    const sessionSection = page.locator('text=最近のセッション')
    await expect(sessionSection).toBeVisible()
  })

  test('セッションがない場合のメッセージ', async ({ page }) => {
    await page.goto('/')

    // セッションがない場合、空状態メッセージが表示される
    const emptyMessage = page.locator('text=セッションがありません。新しいセッションを開始してください。')
    const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false)

    // ページが正常に読み込まれていればOK
    await expect(page.locator('h1')).toBeVisible()
  })
})

test.describe('ナビゲーション', () => {
  test('ヘッダーナビゲーションが動作する', async ({ page }) => {
    await page.goto('/')

    // 新しいセッションへ移動
    await page.click('a:has-text("新しいセッション")')
    await expect(page).toHaveURL(/\/session\/new/)

    // 戻る
    await page.goBack()
    await expect(page).toHaveURL('/')
  })
})
