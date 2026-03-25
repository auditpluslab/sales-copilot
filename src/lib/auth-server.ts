import { createClient } from "@/lib/db/supabase"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

/**
 * サーバーサイドで認証チェックを行う
 * 認証済みの場合はuser_idを返す
 * 未認証の場合は401レスポンスを返す
 */
export async function requireAuth() {
  // モック認証チェック（E2Eテスト用）
  if (process.env.NODE_ENV !== "production") {
    const cookieStore = await cookies()
    const mockAccessToken = cookieStore.get("sb-access-token")

    if (mockAccessToken?.value === "test-mock-access-token") {
      return "test-user-id"
    }
  }

  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }

  return session.user.id
}

/**
 * サーバーサイドで認証チェックを行い、user_idを返す
 * 認証済みの場合はuser_id文字列を返す
 * 未認証の場合はnullを返す
 */
export async function getUserId(): Promise<string | null> {
  // モック認証チェック（E2Eテスト用）
  if (process.env.NODE_ENV !== "production") {
    const cookieStore = await cookies()
    const mockAccessToken = cookieStore.get("sb-access-token")

    if (mockAccessToken?.value === "test-mock-access-token") {
      return "test-user-id"
    }
  }

  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    return null
  }

  return session.user.id
}
