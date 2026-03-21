# デプロイ手順

## Vercelへのデプロイ

### 1. 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定してください：

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名キー | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスロールキー | ✅ |
| `NEXT_PUBLIC_WHISPER_MODEL_SIZE` | Whisperモデルサイズ (tiny/base/small) | ❌ |
| `GLM_API_KEY` | Zhipu AI APIキー | ✅ |
| `GLM_BASE_URL` | Zhipu AI APIベースURL | ❌ |
| `INNGEST_EVENT_KEY` | Inngestイベントキー | ✅ |
| `INNGEST_SIGNING_KEY` | Inngest署名キー | ✅ |

### 2. Supabaseのセットアップ

1. Supabaseプロジェクトを作成
2. `supabase/schema.sql` をSupabaseのSQLエディタで実行
3. 環境変数を取得してVercelに設定

### 3. Inngestのセットアップ

1. [Inngest Cloud](https://app.inngest.com/) でアカウント作成
2. 新しいアプリを作成
3. 環境変数を取得してVercelに設定
4. `npm run inngest:dev` で開発中、Inngest Dev Serverを起動

### 4. デプロイ実行

```bash
# Vercel CLIのインストール（初回のみ）
npm i -g vercel

# プロジェクトのデプロイ
vercel --prod
```

または、VercelダッシュボードからGit連携で自動デプロイを設定。

## 本番環境での確認事項

- [ ] SupabaseのRLSポリシーを本番用に調整
- [ ] Inngestの本番環境キーを使用
- [ ] GLM APIキーの quota を確認
- [ ] Whisperモデルサイズを本番用に調整（推奨: base）
