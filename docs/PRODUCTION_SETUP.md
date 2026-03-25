# 本番環境設定

## 1. Supabaseダッシュボード設定

### レート制限
```
1. Supabaseダッシュボードにアクセス
2. Authentication → Policies → Rate Limiting
3. 以下の設定を追加:
   - Email: 5 requests per 15 minutes
   - API: 60 requests per minute per IP
```

### メール確認の有効化
```
1. Supabaseダッシュボード → Authentication
2. Providers → Email
3. Confirm email: ON
4. Template: デフォルト設定で有効化
```

### Row Level Security確認
```
1. Supabaseダッシュボード → Database
2. Policies を確認
3. 以下のポリシーが有効になっていることを確認:
   - Users can view own sessions
   - Users can insert own sessions
   - Users can update own sessions
   - Users can view own insights
   - Users can insert own insights
   - Users can update own insights
   - Users can view own transcript segments
   - Users can insert own transcript segments
```

## 2. 環境変数設定

### 本番用.env.local
```bash
# 本番URL
NEXT_PUBLIC_APP_URL=https://your-production-domain.com

# Supabase（本番）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key

# セキュリティ（本番用に変更すること）
CSRF_SECRET=<新しいランダム32バイト>
JWT_SECRET=<新しいランダム32バイト>

# GLM AI
GLM_API_KEY=your_production_api_key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/

# Whisper
NEXT_PUBLIC_WHISPER_MODEL_SIZE=base
```

## 3. ビルド設定

### 本番ビルド
```bash
npm run build
npm start
```

### Vercelデプロイ（推奨）
```bash
# Vercel CLIをインストール
npm i -g vercel

# デプロイ
vercel --prod
```

## 4. 本番デプロイ後の確認

### 1. 機能確認
- [ ] ログイン/新規登録が動作する
- [ ] セッション作成が動作する
- [ ] 会議ページが表示される
- [ ] 文字起こしが動作する
- [ ] インサイトが生成される

### 2. セキュリティ確認
- [ ] 未認証ユーザーは/loginにリダイレクト
- [ ] 他ユーザーのデータにアクセスできない
- [ ] CSRFトークンが検証される
- [ ] レート制限が機能している

### 3. パフォーマンス確認
- [ ] ページ読み込みが3秒以内
- [ ] APIレスポンスが1秒以内
- [ ] 文字起こしの遅延が最小限

## 5. 監視設定

### ログ監視
```bash
# Supabaseダッシュボード → Logs
# エラーログを定期確認
```

### アラート設定
```bash
# Supabaseダッシュボード → Alerts
# 以下のアラートを設定:
# - API error rate > 5%
# - Database connection failures
# - Function execution failures
```

## 6. バックアップ設定

### データベースバックアップ
```
Supabaseダッシュボード → Database → Backups
- 自動バックアップ: 毎日
- リテンション期間: 30日
```

## 7. ド緊急対応

### 障害発生時の手順
```bash
1. Supabaseダッシュボードで状態確認
2. ログでエラー原因を特定
3. 必要に応じてロールバック
4. ユーザーへのステータス更新
```
