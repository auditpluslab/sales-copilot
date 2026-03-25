import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// E2Eテスト用のモック認証エンドポイント
// 本番環境では使用しないこと
export async function POST(request: NextRequest) {
  // 本番環境では無効化
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
  }

  try {
    console.log('Test login endpoint called')

    const body = await request.json()
    console.log('Request body:', body)

    const { email } = body

    if (!email) {
      console.log('Email is required')
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    console.log('Setting mock authentication for:', email)

    // モックのユーザー情報とセッションを作成
    const mockUser = {
      id: "test-user-id",
      email: email,
      aud: "authenticated",
      role: "authenticated",
      email_confirmed_at: new Date().toISOString(),
    }

    const mockSession = {
      access_token: "test-mock-access-token",
      refresh_token: "test-mock-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: mockUser,
    }

    // クッキーにセッション情報を設定（Next.js 15+ではcookies()をawaitする必要がある）
    const cookieStore = await cookies()

    console.log('Setting sb-access-token cookie...')
    cookieStore.set("sb-access-token", mockSession.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 3600,
      path: "/",
    })

    console.log('Setting sb-refresh-token cookie...')
    cookieStore.set("sb-refresh-token", mockSession.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 3600,
      path: "/",
    })

    console.log('Mock authentication cookies set successfully')

    return NextResponse.json({
      session: mockSession,
      user: mockUser,
    })
  } catch (error) {
    console.error("Test login error:", error)
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}
