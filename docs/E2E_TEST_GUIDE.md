# Playwright GUIでE2Eテストを実行する方法

## 📊 テスト概要

| テストファイル | テスト数 | 主な機能 |
|----------------|----------|----------|
| **home.spec.ts** | 12 | ホームページ、アクセシビリティ、レスポンシブ |
| **session.spec.ts** | 8 | セッション作成、バリデーション |
| **meeting.spec.ts** | 6 | 会議ページ、タブ、セキュリティ |
| **session-flow.spec.ts** | 10 | セッション作成完全フロー（TDD） |
| **meeting-flow.spec.ts** | 20 | 会議ページ完全フロー（TDD） |
| **security.spec.ts** | 17 | セキュリティテスト |
| **合計** | **73** | 全機能カバレッジ |

---

## 🚀 GUIでテストを実行する方法

### 方法1: インタラクティブスクリプト（推奨）

```bash
./scripts/run-e2e-gui.sh
```

メニューから実行モードを選択できます。

### 方法2: UIモードで直接実行

```bash
# 全テストをUIモードで実行
npm run test:e2e:ui

# または直接
npx playwright test --ui
```

### 方法3: 特定のテストファイルのみ実行

```bash
# ホームページテスト
npx playwright test home.spec.ts --ui

# セッションフローテスト
npx playwright test session-flow.spec.ts --ui

# 会議フローテスト
npx playwright test meeting-flow.spec.ts --ui

# セキュリティテスト
npx playwright test security.spec.ts --ui
```

### 方法4: デバッグモード（ステップ実行）

```bash
npx playwright test --debug
```

機能:
- ステップごとの実行
- ブレークポイントの設定
- 変数のInspect
- 時間の停止・再開

---

## 🎮 Playwright UIモードの使い方

### 起動

```bash
npx playwright test --ui
```

### UI画面の構成

```
┌─────────────────────────────────────────────────┐
│  Playwright Test Runner                         │
├─────────────────────────────────────────────────┤
│                                                 │
│  [テストファイル一覧]      [テスト実行画面]      │
│                                                 │
│  ☐ home.spec.ts           ┌─────────────────┐   │
│    ☐ ページが表示される    │                 │   │
│    ☐ 新しいセッションボタン │   ブラウザ表示   │   │
│    ☐ 機能説明カード       │                 │   │
│                         │                 │   │
│  ☑ session-flow.spec.ts  │                 │   │
│    ☑ セッション作成       │                 │   │
│    ☑ バリデーション      │                 │   │
│                         └─────────────────┘   │
│                                                 │
│  [実行ボタン] [再実行] [デバッグ]              │
└─────────────────────────────────────────────────┘
```

### 基本的な操作

1. **テストの選択**
   - 左パネルからテストファイルまたはテストケースをクリック
   - 複数選択可能

2. **テストの実行**
   - 右上の▶️ボタンをクリック
   - または `Ctrl/Cmd + Enter` で実行

3. **実行速度の調整**
   - ▶️ 通常速度
   - ▶️▶️ 2倍速
   - 🐢 スローモ（観察用）

4. **テストの再実行**
   - ↻ ボタンで失敗したテストのみ再実行
   - ⟲ ボタンですべてのテストを再実行

5. **コードのデバッグ**
   - テストケースをクリックしてコードを表示
   - 行番号をクリックしてブレークポイント設定

---

## 📺 テスト実行のデモ

### シナリオ1: セッション作成フロー

```bash
npx playwright test session-flow.spec.ts --ui
```

実行内容:
1. ホームページを表示
2. 「新しいセッション」をクリック
3. フォームに入力（APIモック）
4. 送信して会議ページへ遷移
5. 成功を確認

### シナリオ2: 会議ページフロー

```bash
npx playwright test meeting-flow.spec.ts --ui
```

実行内容:
1. 会議ページを表示
2. タブ切り替え（インサイト、提案）
3. インサイトの内容確認（課題、制約、ステークホルダー）
4. 提案の内容確認（質問、提案カード）

### シナリオ3: セキュリティテスト

```bash
npx playwright test security.spec.ts --ui
```

実行内容:
1. SQLインジェクション攻撃
2. XSS攻撃（4パターン）
3. 入力バリデーション
4. レート制限
5. 情報漏洩チェック

---

## 🔍 失敗したテストのデバッグ

### ステップ1: 失敗したテストを確認

```bash
npx playwright test --ui
```

### ステップ2: 失敗したテストを選択

- 左パネルで❌マークがついたテストをクリック
- エラーメッセージを確認

### ステップ3: スクリーンショット・動画を確認

失敗したテストでは自動的に保存されます:
- スクリーンショット: `test-results/[test-name]/`
- 動画: `test-results/[test-name]/video.webm`

### ステップ4: デバッグモードで再実行

```bash
npx playwright test --debug
```

---

## 🎨 カスタマイズ

### 特定のブラウザで実行

```bash
# Chromium（デフォルト）
npx playwright test --project=chromium

# Firefox
npx playwright test --project=firefox

# WebKit
npx playwright test --project=webkit
```

### ヘッドレスモード（CLI出力のみ）

```bash
npx playwright test
```

### レポートの出力形式

```bash
# HTMLレポート
npx playwright test --reporter=html

# JSONレポート
npx playwright test --reporter=json > results.json

# カスタムレポーター
npx playwright test --reporter=list,json
```

---

## 🐛 トラブルシューティング

### 開発サーバーが起動しない

```bash
# 手動で起動
npm run dev

# 別ターミナルでテスト実行
npx playwright test
```

### ポートが使用されている

```bash
# ポート3000を解放
lsof -ti:3000 | xargs kill -9

# または別のポートを使用
PORT=3001 npm run dev
```

### ブラウザがインストールされていない

```bash
npx playwright install
```

### テストがタイムアウトする

```playwright.config.ts``` でタイムアウトを調整:

```typescript
export default defineConfig({
  timeout: 60000, // 60秒
  expect: {
    timeout: 10000, // 10秒
  },
})
```

---

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
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## ✅ テスト実行のチェックリスト

### 開発環境

- [ ] 依存関係がインストールされている
- [ ] Playwrightブラウザがインストールされている
- [ ] 開発サーバーが起動している
- [ ] 環境変数が設定されている

### テスト実行前

- [ ] コードの変更を保存
- [ ] コンパイルエラーがない
- [ ] データベースの準備ができている

### テスト実行後

- [ ] 全てのテストがパスしている
- [ ] レポートを確認している
- [ ] 失敗したテストを修正している

---

## 🎓 ベストプラクティス

1. **頻繁に実行する**: コード変更のたびにテストを実行
2. **テストを細かくする**: 1つのテストで1つのことを確認
3. **安定したセレクターを使用**: データ属性を優先
4. **APIをモックする**: 外部依存を排除
5. **意味のある名前を使う**: テストの内容が一目でわかるように

---

## 📚 参考資料

- [Playwright公式ドキュメント](https://playwright.dev/)
- [Playwright UI Mode](https://playwright.dev/docs/test-ui-mode)
- [Playwright Debugging](https://playwright.dev/docs/debug)
- [Best Practices](https://playwright.dev/docs/best-practices)

---

## 💡 ヒント

- **タイムセーブ**: 特定のテストをShift+クリックで複数選択
- **フィルター**: 検索ボックスでテスト名をフィルタリング
- **タブ**: 複数のテストファイルをタブで同時に開ける
- **テーマ**: 明るい/暗いテーマを切り替え可能

---

**Happy Testing! 🎉**
