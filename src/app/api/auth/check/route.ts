import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"

/**
 * 認証チェックエンドポイント
 * 開発環境では常に認証OKを返す
 */
export async function GET() {
  try {
    // 開発環境ではモック認証を返す
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        authenticated: true,
        user: {
          id: "test-user-id",
          email: "test@example.com",
        }
      })
    }

    // 本番環境では実際の認証チェック
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      )
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
      }
    })
  } catch (error) {
    console.error("Auth check error:", error)
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    )
  }
}
