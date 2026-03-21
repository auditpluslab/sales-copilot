# 営業会議コパイロット (Sales Copilot)

会議中にリアルタイムで音声認識・分析を行い、営業担当者を支援するAIアプリケーション。

## 🎯 主な機能

### リアルタイム音声認識
- ブラウザ内で動作するWhisper（Transformers.js）を使用
- 日本語対応の高精度なSTT
- サーバーアーキテクチャ不要でプライベートに実行

### AI分析
- **インサイト抽出**: 顧客の課題、制約、ステークホルダーを自動識別
- **提案生成**: 会話内容に基づいた最適な質問と提案をリアルタイム提示
- **感情分析**: 顧客の温度感をpositive/neutral/negativeで分析

### セッション管理
- セッションごとの会議履歴
- 文字起こしの保存と検索
- インサイト・提案の履歴管理

## 🏗️ 技術スタック

### フロントエンド
- **Next.js 16** - Reactフレームワーク
- **TypeScript** - 型安全な開発
- **Tailwind CSS** - スタイリング
- **shadcn/ui** - UIコンポーネント

### 音声認識
- **@xenova/transformers** - ブラウザ内Whisper実行
- **Web Audio API** - 音声キャプチャ

### AI/LLM
- **GLM-4** (Zhipu AI) - 日本語対応のLLM
- **OpenAI SDK** - GLM互換API

### バックエンド
- **Supabase** - データベース & 認証
- **Inngest** - バックグラウンドジョブ

## 📋 セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd sales-copilot
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local` を作成し、`.env.example` を参考に環境変数を設定：

```bash
cp .env.example .env.local
```

必要な環境変数：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GLM_API_KEY`
- `INNGEST_EVENT_KEY` (オプション)

### 4. Supabaseのセットアップ

1. [Supabase](https://supabase.com/) でプロジェクトを作成
2. SQLエディタで `supabase/schema.sql` を実行
3. プロジェクト設定から環境変数を取得して `.env.local` に設定

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセス

## 🚀 デプロイ

詳細なデプロイ手順は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。

Vercelへのワンクリックデプロイ（準備中）：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## 📊 データベーススキーマ

```
sessions                 # 会議セッション
├── transcript_segments  # 文字起こしデータ
├── insights            # AI分析結果（課題、制約、ステークホルダー）
├── suggestions         # 提案カード
├── rolling_summaries   # 要約履歴
├── next_actions        # 次のアクション
└── feedback_events     # フィードバック
```

## 🧪 テスト

### E2Eテスト

```bash
npm run test:e2e
```

### 単体テスト

```bash
npm run test
```

### GitHub Actionsでのテスト実行

このプロジェクトではGitHub Actionsを使用してCI/CDを自動化しています。

#### 自動実行されるタイミング
- `main`ブランチへのプッシュ時
- `main`ブランチ向けのプルリクエスト作成時

#### ワークフロー
1. **E2Eテスト** (`.github/workflows/e2e-tests.yml`)
   - Ubuntu環境でPlaywrightを実行
   - 開発サーバーを起動してテスト実行
   - テスト結果とスクリーンショットをアップロード

2. **単体テスト** (`.github/workflows/unit-tests.yml`)
   - Vitestを使用した単体テスト実行
   - カバレッジレポートを生成

#### ローカルでテストを実行する場合

macOSなどで権限エラーが発生する場合は、GitHub Actionsで実行することを推奨します：

```bash
# 1. 変更をコミット
git add .
git commit -m "Fix tests"

# 2. GitHubにプッシュ
git push origin main

# 3. GitHub Actionsで自動テスト実行
# https://github.com/<username>/sales-copilot/actions
```

## 📝 プロジェクト構成

```
sales-copilot/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # APIルート
│   │   ├── meeting/      # 会議画面
│   │   └── session/      # セッション管理
│   ├── components/       # Reactコンポーネント
│   │   └── ui/          # shadcn/uiコンポーネント
│   ├── lib/             # ユーティリティ
│   │   ├── llm/        # LLM関数
│   │   ├── stt/        # 音声認識
│   │   └── db/         # データベースクライアント
│   └── types/          # TypeScript型定義
├── supabase/
│   └── schema.sql      # データベーススキーマ
└── e2e/               # Playwright E2Eテスト
```

## 🔧 開発コマンド

```bash
# 開発サーバー
npm run dev

# 本番ビルド
npm run build

# 本番起動
npm start

# Inngest Dev Server
npm run inngest:dev

# Lint
npm run lint

# テスト
npm run test              # 単体テスト
npm run test:e2e          # E2Eテスト
npm run test:e2e:ui       # E2E UIモード
```

## 🎨 Whisperモデルの選択

環境変数 `NEXT_PUBLIC_WHISPER_MODEL_SIZE` でモデルサイズを変更可能：

| サイズ | メモリ | 精度 | 速度 | 推奨環境 |
|--------|--------|------|------|----------|
| `tiny` | ~40MB | 低 | 速 | モバイル |
| `base` | ~140MB | 中 | 中 | デスクトップ（デフォルト） |
| `small` | ~460MB | 高 | 遅 | 高スペックPC |

## 🔒 プライバシー

- 音声データはブラウザ内で処理され、外部サーバーに送信されません（STT）
- 会議データはSupabaseに暗号化保存されます
- GLM APIへの送信は分析目的のみ（文字起こしテキストのみ）

## 📄 ライセンス

MIT License

## 🤝 貢献

Contributions, issues and feature requests are welcome!

## 📧 お問い合わせ

プロジェクトに関する質問やフィードバックは、Issueまでお願いします。
