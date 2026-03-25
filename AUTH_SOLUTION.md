# Supabase Edge Functionsの認証問題の解決策

## 現状の問題
Supabase Edge FunctionsがJWT認証を要求しており、apikeyヘッダーだけではバイパスできません。

## 解決策（推奨順）

### ✅ 方法1: Supabase Authを使用したJWT認証（最も安全）

フロントエンドでSupabase Authを使って匿名認証を行い、有効なJWTトークンを取得します。

```typescript
// lib/auth.ts
import { createClient } from '@/lib/db/supabase'

export async function getAccessToken() {
  const supabase = createClient()

  // 匿名認証でサインイン
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    console.error('Auth error:', error)
    return null
  }

  return data.session.access_token
}
```

 Functions呼び出し時にJWTトークンを使用：

```typescript
// lib/stt/hooks.ts
import { getAccessToken } from '@/lib/auth'

onTranscript: async (segment) => {
  // ... segment処理 ...

  if (segment.is_final) {
    const accessToken = await getAccessToken()

    if (!accessToken) {
      console.error('Failed to get access token')
      return
    }

    const functionUrl = `${supabaseUrl}/functions/v1/transcript-received`

    await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`, // 有効なJWTトークン
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({
        sessionId,
        segment: {
          id: segment.id,
          ts_start: segment.ts_start,
          ts_end: segment.ts_end,
          text: segment.text,
          is_final: segment.is_final,
          speaker: segment.speaker,
        },
      }),
    })
  }
}
```

### ⚠️ 方法2: Dashboardで認証を無効にする（簡易的だがセキュリティリスクあり）

1. Supabase Dashboardにアクセス
2. Functions → 各Functionを選択
3. 「Authentication」を「None」に設定

**リスク:**
- 誰でもFunctionsを呼び出せる
- APIキーが漏洩すると悪用される可能性
- DoS攻撃の対象になる

**緩和策:**
- レート制限を実装する
- IP制限をかける
- データベースのRLSポリシーを維持する

### 🔧 方法3: Functions内で独自認証を実装する

Functionsコード内でapikeyの検証を行います。

```typescript
// Functionsコード内
serve(async (req) => {
  const apiKey = req.headers.get('apikey')
  const validApiKeys = [
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  ]

  if (!apiKey || !validApiKeys.includes(apiKey)) {
    return new Response(
      JSON.stringify({ error: 'Invalid apikey' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // 認証成功、処理を続行
  // ...
})
```

## 推奨するアプローチ

**方法1（JWT認証）を実装することを強く推奨します。**

### 理由:
1. ✅ セキュリティが高い
2. ✅ Supabaseの標準的な認証方法
3. ✅ ユーザー管理機能を後で追加できる
4. ✅ セッション管理が簡単

### 実装ステップ:
1. Supabase Dashboardで「Anonymous sign-ins」を有効にする
2. フロントエンドで匿名認証を実装
3. Functions呼び出し時にJWTトークンを使用

## 緊急の回避策（あくまで一時的）

どうしても今すぐFunctionsを使いたい場合:

1. **認証を無効にする**
2. **同時に以下のセキュリティ対策を実装:**
   - Functions内でレート制限
   - データサイズの制限
   - IPアドレスのログ取得
   - 異常なリクエストの検知

## まとめ

| 方法 | セキュリティ | 実装難易度 | 推奨度 |
|------|-----------|-------------|--------|
| JWT認証 | ⭐⭐⭐⭐⭐ | 中 | ✅ 推奨 |
| 認証無効 | ⭐⭐ | 低 | ❌ 非推奨 |
| 独自認証 | ⭐⭐⭐ | 高 | △ 状況による |

**結論: セキュリティを考慮すると、JWT認証を実装することを強く推奨します。**
