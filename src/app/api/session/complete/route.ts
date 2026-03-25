import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"

// POST /api/session/complete - セッション完了処理
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id } = body

    if (!session_id) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      )
    }

    // JWTトークンを取得
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    const accessToken = session.access_token
    const userId = session.user.id

    // Supabase Edge Functionを呼び出す
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      )
    }

    const functionUrl = `${supabaseUrl}/functions/v1/session-ended`

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({ sessionId: session_id, userId }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("Supabase Function error:", error)
      return NextResponse.json(
        { error: "Failed to complete session" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Failed to complete session:", error)
    return NextResponse.json(
      { error: "Failed to complete session" },
      { status: 500 }
    )
  }
}
