# Supabase マイグレーション手順

## 開発環境でのセットアップ

### 1. Supabase CLIのインストール

```bash
npm install -g supabase
```

### 2. Supabaseプロジェクトのリンク

```bash
supabase link --project-ref <your-project-ref>
```

プロジェクトリファレンスはSupabaseダッシュボードの設定から確認できます。

### 3. ローカル開発環境の起動

```bash
supabase start
```

これでローカルでPostgreSQLとSupabase APIが起動します。

### 4. マイグレーションの適用

```bash
# 既存のマイグレーションを適用
supabase db push

# またはリモートからプル
supabase db pull
```

## 本番環境へのデプロイ

### 方法1: Supabaseダッシュボードから実行

1. [Supabaseダッシュボード](https://supabase.com/dashboard) にアクセス
2. プロジェクトを選択
3. SQL Editor を開く
4. `supabase/schema.sql` の内容をコピーして実行

### 方法2: CLIからデプロイ

```bash
# マイグレーションファイルをリモートに適用
supabase db push --linked
```

## マイグレーションファイルの管理

### 新しいマイグレーションを作成

```bash
supabase migration new <migration-name>
```

### ローカルでの変更を確認

```bash
supabase db diff
```

### ローカルで変更をリセット

```bash
supabase db reset
```

## 環境変数の取得

マイグレーション適用後、以下の環境変数を取得して `.env.local` に設定してください：

1. **Supabase URL**: Project Settings → API → URL
2. **anon public**: Project Settings → API → anon public key
3. **service_role**: Project Settings → API → service_role key（秘密キー、慎重に扱って）

## 既存のマイグレーション

| ファイル名 | 説明 |
|-----------|------|
| `20240321000000_initial_schema.sql` | 初期スキーマ（全テーブル） |

## トラブルシューティング

### 外部キー制約エラー

テーブルの作成順序に問題がある場合、`schema.sql` を直接実行してください：

```bash
# SQLエディタから実行するのが最も確実です
```

### RLS（Row Level Security）のエラー

開発環境では匿名アクセスを許可していますが、本番環境では適切なRLSポリシーを設定してください：

```sql
-- 例: ユーザー認証後のポリシー
create policy "Users can view own sessions"
on sessions for select
using (auth.uid()::text = created_by::text);
```

## ロールバック

マイグレーションをロールバックする場合：

```bash
supabase migration repair <migration-version> --status reverted
```
