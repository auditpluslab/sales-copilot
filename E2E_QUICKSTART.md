# E2Eテスト実行クイックスタート

## 🚀 すぐに始める

### 方法1: 一番簡単な方法

```bash
npm run test:e2e:ui
```

これだけでPlaywright UIが起動します！

### 方法2: スクリプトを使用

```bash
./scripts/run-e2e.sh gui
```

メニューから選択できます。

### 方法3: 特定のテストのみ実行

```bash
# ホームページテスト
npx playwright test home.spec.ts --ui

# セッションフロー（TDD）
npx playwright test session-flow.spec.ts --ui

# 会議フロー（TDD）
npx playwright test meeting-flow.spec.ts --ui

# セキュリティテスト
npx playwright test security.spec.ts --ui
```

---

## 📊 テスト一覧（63テスト）

| テストファイル | テスト数 | 実行コマンド |
|----------------|----------|-------------|
| home.spec.ts | 9 | `npx playwright test home.spec.ts --ui` |
| session.spec.ts | 7 | `npx playwright test session.spec.ts --ui` |
| session-flow.spec.ts | 8 | `npx playwright test session-flow.spec.ts --ui` |
| meeting.spec.ts | 6 | `npx playwright test meeting.spec.ts --ui` |
| meeting-flow.spec.ts | 16 | `npx playwright test meeting-flow.spec.ts --ui` |
| security.spec.ts | 17 | `npx playwright test security.spec.ts --ui` |

---

## 🎮 Playwright UIモードの操作

### 起動

```bash
npm run test:e2e:ui
```

### 画面構成

```
┌──────────────────────────────────────────────┐
│  Playwright Test Runner                     │
├──────────────────────────────────────────────┤
│                                              │
│  左: テスト一覧        右: ブラウザ表示       │
│                                              │
│  ☐ home.spec.ts       ┌──────────────────┐   │
│  ☐ session-flow.ts   │                  │   │
│  ☐ security.spec.ts  │  テスト実行画面    │   │
│                      │                  │   │
│                      └──────────────────┘   │
│                                              │
│  ▶️ 実行  ↻ 再実行  🐢 スローモ              │
└──────────────────────────────────────────────┘
```

### 基本操作

1. **テスト選択**: 左パネルからクリック
2. **実行**: ▶️ボタンまたは Ctrl+Enter
3. **再実行**: ↻ボタン
4. **スローモード**: 🐢ボタン（観察用）

---

## 🐛 デバッグモード

ステップ実行したい場合：

```bash
npm run test:e2e:debug
```

機能:
- ブレークポイント設定
- ステップ実行（F10/F11）
- 変数のInspect
- 時間の停止

---

## 📺 ヘッドモード（ブラウザを表示）

実際のブラウザ操作を見たい場合：

```bash
npm run test:e2e:headed
```

---

## 📋 実行前チェックリスト

- [ ] 開発サーバーが起動している (`npm run dev`)
- [ ] Playwrightがインストールされている (`npx playwright install`)
- [ ] 環境変数が設定されている (`.env.local`)

---

## ✅ 成功したら

全テストがパスしたら、次のステップ：

1. **レポートを確認**
   ```bash
   npx playwright show-report
   ```

2. **CI/CDに統合**
   - GitHub Actions
   - Vercelのプレデプロイ

3. **テストを追加**
   - 新機能のテスト
   - バグ修正の検証

---

## 💡 トラブルシューティング

### ポート3000が使用中

```bash
lsof -ti:3000 | xargs kill -9
```

### ブラウザが起動しない

```bash
npx playwright install
```

### テストが失敗する

1. 開発サーバーを確認
2. 環境変数を確認
3. デバッグモードで詳細確認: `npm run test:e2e:debug`

---

**Happy Testing! 🎉**
