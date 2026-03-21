# E2Eテストガイド

## テストの概要

このプロジェクトでは [Playwright](https://playwright.dev/) を使用してE2Eテストを実装しています。

## テストファイル

| ファイル | 説明 |
|---------|------|
| `home.spec.ts` | ホームページのUIテスト、アクセシビリティ、レスポンシブデザイン |
| `session.spec.ts` | セッション作成フォームのバリデーション、ナビゲーション |
| `meeting.spec.ts` | 会議ページのUI、タブ切り替え、セキュリティ、パフォーマンス |

## テストの実行

### 全テストの実行

```bash
npm run test:e2e
```

### ヘッドレスモードで実行

```bash
npx playwright test --headed
```

### UIモードで実行

```bash
npm run test:e2e:ui
```

### デバッグモードで実行

```bash
npm run test:e2e:debug
```

### 特定のテストファイルのみ実行

```bash
npx playwright test home.spec.ts
```

### 特定のテストのみ実行

```bash
npx playwright test -g "ホームページ"
```

## テストカバレッジ

### ✅ 実装済みのテスト

#### ホームページ（home.spec.ts）
- [x] ページ表示
- [x] 新しいセッションボタン
- [x] 機能説明カード
- [x] ページ遷移
- [x] 見出し構造（アクセシビリティ）
- [x] キーボードナビゲーション
- [x] モバイル/タブレット/デスクトップ表示

#### セッション作成（session.spec.ts）
- [x] フォーム表示
- [x] バリデーション（必須項目、文字数制限）
- [x] セッション作成
- [x] セッション一覧表示
- [x] 空状態メッセージ
- [x] ナビゲーション

#### 会議ページ（meeting.spec.ts）
- [x] ページ構造
- [x] タブ切り替え
- [x] XSS脆弱性チェック
- [x] SQLインジェクションチェック
- [x] ページ読み込み時間
- [x] コンソールエラー確認

## テスト環境

### ローカル開発

1. 開発サーバーを起動：
```bash
npm run dev
```

2. 別のターミナルでテストを実行：
```bash
npm run test:e2e
```

### CI/CD環境

GitHub ActionsやVercelでの自動テストを推奨：

```yaml
# .github/workflows/e2e.yml の例
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm start &
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
```

## テストの書き方

### 基本的なテスト構造

```typescript
import { test, expect } from '@playwright/test'

test.describe('機能名', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/target-page')
  })

  test('テスト名', async ({ page }) => {
    // アクション
    await page.click('button')

    // アサーション
    await expect(page.locator('.result')).toBeVisible()
  })
})
```

### セレクターのベストプラクティス

```typescript
// 良い例（安定）
await page.click('button:has-text("送信")')
await page.fill('[name="email"]', 'test@example.com')
await expect(page.locator('h1')).toContainText('タイトル')

// 避けるべき（脆弱）
await page.click('.btn-primary') // クラス名は変更されやすい
await page.click('#submit123')   // 動的ID
```

## トラブルシューティング

### テストが失敗する場合

1. **タイミングの問題**
   ```typescript
   // 明示的に待機
   await page.waitForSelector('.element')
   await page.waitForTimeout(1000) // 最後の手段
   ```

2. **セレクターが見つからない**
   ```typescript
   // デバッガーでセレクターを確認
   npx playwright codegen http://localhost:3000
   ```

3. **ネットワークリクエストの待機**
   ```typescript
   // APIレスポンスを待機
   await page.waitForResponse(resp => resp.url().includes('/api/session'))
   ```

### テストの実行が遅い場合

- `playwright.config.ts` で `workers` を増やす
- テストを並列実行可能にする
- 不要な `waitForTimeout` を削除

## カバレッジレポート

```bash
# HTMLレポートを生成
npx playwright test --reporter=html

# レポートを表示
npx playwright show-report
```

## リソース

- [Playwright公式ドキュメント](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
