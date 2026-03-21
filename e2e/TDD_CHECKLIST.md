# TDD GUIテスト実行ガイド

## 🎯 TDDサイクルの概要

```
┌─────────────────────────────────────────────────────┐
│  RED（赤）: まずテストを書いて、失敗することを確認        │
├─────────────────────────────────────────────────────┤
│  GREEN（緑）: 最小限のコードを書いて、テストを通す        │
├─────────────────────────────────────────────────────┤
│  REFACTOR（青）: コードをリファクタリング               │
└─────────────────────────────────────────────────────┘
```

## 📋 新規追加テスト

### 1. セッション作成フロー（session-flow.spec.ts）

#### REDフェーズのテスト
- [ ] ✅ 新しいセッションを作成して会議ページへ遷移する
- [ ] ✅ 必須項目未入力でバリデーションエラー

#### GREENフェーズのテスト
- [ ] ✅ セッション一覧が表示される
- [ ] ✅ セッションカードをクリックして会議ページへ

#### REFACTORフェーズのテスト
- [ ] ✅ フォーム入力の速度テスト
- [ ] ✅ モバイルでのフォーム操作性

#### エラーハンドリング
- [ ] ✅ APIエラー時の適切な表示
- [ ] ✅ ネットワークエラー時のリトライ

### 2. 会議ページフロー（meeting-flow.spec.ts）

#### REDフェーズのテスト
- [ ] ✅ 会議開始ボタンで録音状態になる
- [ ] ✅ 会議終了で録音停止

#### GREENフェーズのテスト（インサイト）
- [ ] ✅ インサイトタブで要約が表示される
- [ ] ✅ 課題ポイントが正しく表示される
- [ ] ✅ 制約事項が表示される
- [ ] ✅ ステークホルダーが表示される
- [ ] ✅ 温度感が表示される

#### GREENフェーズのテスト（提案）
- [ ] ✅ 提案タブで質問が表示される
- [ ] ✅ 提案カードが表示される

#### REFACTORフェーズのテスト
- [ ] ✅ タブ切り替えがスムーズ
- [ ] ✅ スクロールがスムーズ
- [ ] ✅ モバイルでの表示

#### 文字起こし
- [ ] ✅ 文字起こしタブでリアルタイム更新
- [ ] ✅ 空の文字起こし時にメッセージ表示

#### エラーハンドリング
- [ ] ✅ インサイト読み込みエラー
- [ ] ✅ STT接続エラー時のリトライ

## 🚀 テストの実行方法

### 開発環境での実行

```bash
# 1. 開発サーバーを起動（ターミナル1）
npm run dev

# 2. E2Eテストを実行（ターミナル2）
# 全テスト実行
npm run test:e2e

# 特定のテストファイルのみ実行
npx playwright test session-flow.spec.ts
npx playwright test meeting-flow.spec.ts

# ヘッドレスモードで実行（UIを見ながらテスト）
npx playwright test --headed

# UIモード（対話的なテスト実行）
npm run test:e2e:ui

# デバッグモード（ステップ実行）
npm run test:e2e:debug
```

### 特定のテストのみ実行

```bash
# セッションフローのテストのみ
npx playwright test session-flow.spec.ts

# 会議フローのテストのみ
npx playwright test meeting-flow.spec.ts

# 特定のテスト名を指定
npx playwright test -g "セッション作成"
npx playwright test -g "会議開始"
```

## 🔍 TDDサイクルの実践例

### 例: セッション作成機能の実装

#### 1. RED: まずテストを書く

```typescript
// session-flow.spec.ts
test('新しいセッションを作成して会議ページへ遷移する', async ({ page }) => {
  await page.goto('/')
  await page.click('a:has-text("新しいセッション")')
  await page.fill('#client_name', 'テスト株式会社')
  await page.fill('#meeting_title', '初回ヒアリング')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/meeting\//)
})
```

#### 2. テストを実行して失敗を確認

```bash
npx playwright test session-flow.spec.ts -g "セッション作成"
# ❌ FAILED: テストが失敗することを確認
```

#### 3. GREEN: 最小限のコードを書く

```typescript
// 必要な実装を追加
// - APIエンドポイント: /api/session
// - フォームバリデーション
// - リダイレクト処理
```

#### 4. テストを実行して成功を確認

```bash
npx playwright test session-flow.spec.ts -g "セッション作成"
# ✅ PASSED: テストが成功
```

#### 5. REFACTOR: リファクタリング

```typescript
// コードを整理、最適化
// - コンポーネントの分割
// - 共通ロジックの抽出
// - パフォーマンス改善
```

#### 6. 再度テスト実行して確認

```bash
npx playwright test session-flow.spec.ts
# ✅ ALL PASSED: リファクタリング後もテストが通る
```

## 📊 テストカバレッジ

### 既存テスト
- ✅ home.spec.ts - ホームページのUI/UX
- ✅ session.spec.ts - セッション作成基本機能
- ✅ meeting.spec.ts - 会議ページ基本機能

### 新規追加テスト
- ✅ session-flow.spec.ts - セッション作成完全フロー
- ✅ meeting-flow.spec.ts - 会議ページ完全フロー

### 合計カバレッジ

| 機能 | テスト数 | 状態 |
|------|----------|------|
| ホームページ | 12件 | ✅ |
| セッション作成 | 8件 | ✅ |
| セッションフロー | 8件 | ✅ |
| 会議ページ | 6件 | ✅ |
| 会議フロー | 18件 | ✅ |
| **合計** | **52件** | **✅** |

## 🛠️ APIモックの使用

テストではAPIレスポンスをモックしているため、実際のバックエンドを必要としません：

```typescript
// APIレスポンスをモック
await page.route('**/api/session', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      session: {
        id: 'test-123',
        title: 'テスト会議',
        // ...
      }
    })
  })
})
```

## 🐛 トラブルシューティング

### テストが失敗する場合

#### 1. タイミングの問題

```typescript
// 明示的に待機する
await page.waitForSelector('.element')
await page.waitForTimeout(1000) // 最後の手段
```

#### 2. セレクターが見つからない

```typescript
// デバッガーでセレクターを確認
npx playwright codegen http://localhost:3000

// より具体的なセレクターを使用
await page.click('button[type="submit"]:has-text("送信")')
```

#### 3. APIモックが効かない

```typescript
// ルートが設定されている前にページをロードしていないか確認
test.beforeEach(async ({ page }) => {
  // ここでルート設定
  await page.route('**/api/**', handler)
  await page.goto('/') // その後でページ遷移
})
```

### 実行速度が遅い場合

```typescript
// playwright.config.ts で並列実行数を増やす
export default defineConfig({
  workers: 4, // デフォルトはCPUコア数
  // ...
})
```

## 📈 CI/CDへの統合

### GitHub Actionsの例

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## ✅ テスト完了のチェックリスト

- [ ] 全てのテストがパスする
- [ ] カバレッジが80%以上
- [ ] CI/CDパイプラインに統合されている
- [ ] テストレポートが生成されている
- [ ] 重大なバグが検出されていない
- [ ] リファクタリング後もテストが通っている

## 🎓 ベストプラクティス

1. **小さく始める**: 1つの機能につき1つのテストから始める
2. **頻繁に実行する**: コード変更のたびにテストを実行
3. **APIをモックする**: 外部依存を切り離してテストを安定させる
4. **意味のあるテスト名をつける**: テストの内容が一目でわかるように
5. **独立性を保つ**: テスト同士が依存しないようにする

## 📚 参考資料

- [Playwright公式ドキュメント](https://playwright.dev/)
- [TDDとアジャイルテスト](https://www.agilealliance.org/)
- [Testing Best Practices](https://testingjavascript.com/)
