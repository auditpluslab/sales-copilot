// Supabase Authを使ったJWTトークン取得

import { createClient } from '@/lib/db/supabase'

/**
 * 匿名認証でサインインし、JWTトークンを取得
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient()

  try {
    // 匿名認証でサインイン
    const { data, error } = await supabase.auth.signInAnonymously()

    if (error || !data?.session?.access_token) {
      console.error('Anonymous auth error:', error)
      return null
    }

    // JWTトークンを返す
    return data.session.access_token
  } catch (error) {
    console.error('Failed to get access token:', error)
    return null
  }
}

/**
 * 現在のセッションからJWTトークンを取得
 */
export async function getCurrentAccessToken(): Promise<string | null> {
  const supabase = createClient()

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      // セッションがない場合は匿名認証
      return await getAccessToken()
    }

    return session.access_token
  } catch (error) {
    console.error('Failed to get current access token:', error)
    return null
  }
}
