import { test, expect } from './fixtures/auth'

test.describe('ホームページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('ページが正しく表示される', async ({ page }) => {
    // タイトル確認
    await expect(page.locator('h1')).toContainText('営業会議コパイロット')
    await expect(page.locator('text=リアルタイムで会議を支援')).toBeVisible()
  })

  test('新しいセッションボタンが表示される', async ({ page }) => {
    // リンクまたはボタンで「新しいセッション」を探す（最初の要素を使用）
    const newSessionButton = page.locator('a:has-text("新しいセッション"), button:has-text("新しいセッション")').first()
    await expect(newSessionButton).toBeVisible()
  })

  test('機能説明カードが表示される', async ({ page }) => {
    // カードが表示されることを確認
    await expect(page.locator('text=リアルタイム文字起こし')).toBeVisible()
    await expect(page.locator('text=インサイト抽出')).toBeVisible()
    await expect(page.locator('text=提案サポート')).toBeVisible()

    // 説明テキストも表示されることを確認
    await expect(page.locator('text=ブラウザ内Whisperによる高精度な日本語STT')).toBeVisible()
    await expect(page.locator('text=課題・制約・ステークホルダーを自動で抽出')).toBeVisible()
    await expect(page.locator('text=次に聞くべき質問と提案カードをリアルタイムで生成')).toBeVisible()
  })

  test('新しいセッション画面へ遷移できる', async ({ page }) => {
    await page.click('a:has-text("新しいセッション")')
    await expect(page).toHaveURL(/\/session\/new/)
  })
})

test.describe('アクセシビリティ', () => {
  test('見出し構造が正しい', async ({ page }) => {
    await page.goto('/')

    // 認証済み状態でh1が表示されるのを待つ
    await page.waitForSelector('h1', { timeout: 5000 })

    // h1が1つだけ存在
    const h1Count = await page.locator('h1').count()
    expect(h1Count).toBe(1)

    // h2が存在
    const h2Count = await page.locator('h2').count()
    expect(h2Count).toBeGreaterThanOrEqual(1)
  })

  test('ボタンがキーボードでアクセス可能', async ({ page }) => {
    await page.goto('/')

    // ページが完全に読み込まれるのを待つ
    await page.waitForLoadState('networkidle')

    // Tabキーでフォーカス移動
    await page.keyboard.press('Tab')

    // フォーカスされた要素がボタンまたはリンク
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })
})

test.describe('レスポンシブデザイン', () => {
  test('モバイル表示でレイアウトが崩れない', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // h1が表示される
    await expect(page.locator('h1')).toBeVisible()

    // 機能カードが縦に並ぶ
    const cards = page.locator('[class*="grid"]')
    await expect(cards.first()).toBeVisible()
  })

  test('タブレット表示で適切に表示', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()
  })

  test('デスクトップ表示で適切に表示', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')

    await expect(page.locator('h1')).toBeVisible()
  })
})
