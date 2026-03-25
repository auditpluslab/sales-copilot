import { NextResponse } from "next/server"
import { generateCsrfToken, setCsrfCookie } from "@/lib/security/csrf"
import { requireAuth } from "@/lib/auth-server"
import { cookies } from "next/headers"

// GET /api/auth/csrf - CSRFトークン取得
export async function GET() {
  try {
    // 開発環境では認証なしでCSRFトークンを発行（テスト用）
    if (process.env.NODE_ENV !== "production") {
      // CSRFトークンを生成
      const token = await generateCsrfToken()

      // クッキーに設定
      await setCsrfCookie(token)

      return NextResponse.json({ csrf_token: token })
    }

    // 本番環境では認証チェック
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    // CSRFトークンを生成
    const token = await generateCsrfToken()

    // クッキーに設定
    await setCsrfCookie(token)

    return NextResponse.json({ csrf_token: token })
  } catch (error) {
    console.error("Failed to generate CSRF token:", error)
    return NextResponse.json(
      { error: "Failed to generate CSRF token" },
      { status: 500 }
    )
  }
}
