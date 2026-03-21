# Inngest バックグラウンドジョブ設定

## 概要

このプロジェクトでは [Inngest](https://inngest.com/) を使用して、以下のバックグラウンド処理を実行しています：

1. **セッション開始時の初期化**
2. **文字起こしセグメントの保存**
3. **定期分析（90秒ごと）**
4. **セッション終了時の処理**

## 開発環境でのセットアップ

### 1. Inngest CLIのインストール

```bash
npm install -g inngest-cli
```

またはプロジェクトローカル：

```bash
npm install --save-dev inngest-cli
```

### 2. Inngest Dev Serverの起動

```bash
npm run inngest:dev
```

これで `http://localhost:8288` でInngest Dev Serverが起動します。

### 3. アプリケーションの起動

別のターミナルで：

```bash
npm run dev
```

## 本番環境へのデプロイ

### 1. Inngest Cloud アカウントの作成

1. [Inngest Cloud](https://app.inngest.com/) にアクセス
2. GitHubアカウントでサインアップ
3. 新しいアプリを作成

### 2. 環境変数の設定

Vercel（または使用するホスティングサービス）で以下の環境変数を設定：

| 変数名 | 説明 | 取得場所 |
|--------|------|----------|
| `INNGEST_EVENT_KEY` | イベント送信用キー | Inngestダッシュボード → App Settings |
| `INNGEST_SIGNING_KEY` | ジョブ署名用キー | Inngestダッシュボード → App Settings |

### 3. Inngestへデプロイ

```bash
# Inngest CLIでデプロイ
npx inngest deploy -u https://www.your-app.com
```

または、InngestダッシュボードからGitHub連携で自動デプロイを設定。

### 4. Vercelへの統合

Vercelの環境変数に設定後、以下のコマンドでデプロイ：

```bash
vercel --prod
```

## Inngest関数の詳細

### sessionStarted
セッション開始時の初期化処理

- **イベント**: `session/started`
- **処理**:
  - 初期分析ジョブのスケジュール（90秒後）
- **頻度**: セッション開始時のみ

### transcriptReceived
文字起こしセグメントの保存

- **イベント**: `transcript/received`
- **処理**:
  - 文字起こしをデータベースに保存
- **頻度**: 文字起こし受信時（リアルタイム）

### analysisTriggered
定期分析トリガー

- **イベント**: `analysis/triggered`
- **処理**:
  - 直近90秒の文字起こしを取得
  - 既存のインサイトを取得
  - インサイトを生成・更新
- **頻度**: 90秒ごと（可変）

### sessionEnded
セッション終了時の処理

- **イベント**: `session/ended`
- **処理**:
  - セッションの終了時刻を更新
  - ステータスを「完了」に変更
- **頻度**: セッション終了時のみ

## イベントの送信方法

### サーバーサイドから送信

```typescript
import { inngest } from '@/lib/inngest/client'

// イベントを送信
await inngest.send({
  name: 'session/started',
  data: { sessionId: 'session-123' }
})
```

### APIから送信

```typescript
// /api/session/complete/route.ts の例
await inngest.send({
  name: 'session/completed',
  data: { session_id: sessionId }
})
```

## 監視とデバッグ

### Inngestダッシュボード

- **URL**: https://app.inngest.com/
- **機能**:
  - 実行中のジョブの確認
  - 失敗したジョブの再実行
  - イベント履歴の確認
  - パフォーマンスの監視

### ログの確認

```bash
# 開発環境でのログ
npm run inngest:dev

# ログがリアルタイムで表示されます
```

### トラブルシューティング

#### ジョブが実行されない場合

1. 環境変数が正しく設定されているか確認
2. Inngest Dev Serverが起動しているか確認（開発環境）
3. イベントが正しく送信されているか確認

```typescript
// デバッグ用ログ
console.log('Sending Inngest event:', { name: 'session/started', data })
await inngest.send({ name: 'session/started', data })
```

#### ジョブが失敗する場合

1. Inngestダッシュボードでエラーログを確認
2. リトライ回数を確認（デフォルト: 3回）
3. タイムアウト設定を確認

```typescript
// タイムアウトの調整
export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "my/event" },
  async ({ event, step }) => {
    // 処理
  },
  {
    // オプション
    retries: 5,
    timeout: '5m',
  }
)
```

## ベストプラクティス

### 1. イベントの設計

- イベント名は `ドメイン/アクション` 形式にする
  - 良い例: `session/started`, `transcript/received`
  - 悪い例: `start`, `data`

### 2. エラーハンドリング

```typescript
export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "my/event" },
  async ({ event, step }) => {
    try {
      // 処理
      await riskyOperation()
      return { success: true }
    } catch (error) {
      console.error('Error:', error)
      // 失敗してもリトライさせるため例外を投げる
      throw error
    }
  }
)
```

### 3. ステップの使用

長時間実行される処理はステップに分割：

```typescript
export const myFunction = inngest.createFunction(
  { id: "my-function" },
  { event: "my/event" },
  async ({ event, step }) => {
    // ステップ1: データ取得
    const data = await step.run('fetch-data', async () => {
      return await fetchData()
    })

    // ステップ2: データ処理
    const processed = await step.run('process-data', async () => {
      return await processData(data)
    })

    return processed
  }
)
```

### 4. レート制限

外部APIを呼び出す際はレート制限に注意：

```typescript
const result = await step.run('call-api', async () => {
  // レート制限を考慮
  await delay(1000)
  return await externalAPI.call()
})
```

## コストの最適化

### イベント数の削減

- 重要なイベントのみ送信
- バッチ処理を検討

### ジョブの実行時間短縮

- ステップ分割で並列実行
- キャッシングの活用
- データベースクエリの最適化

### 開発環境ではDev Serverを使用

```bash
# 開発環境（無料）
npm run inngest:dev

# 本番環境のみCloudを使用
INNGEST_EVENT_KEY=prod_key npm start
```

## 追加リソース

- [Inngestドキュメント](https://www.inngest.com/docs)
- [TypeScript SDK](https://www.inngest.com/docs/sdk/typescript)
- [ベストプラクティス](https://www.inngest.com/docs/best-practices)
- [Vercel統合](https://www.inngest.com/docs/deploy/vercel)
