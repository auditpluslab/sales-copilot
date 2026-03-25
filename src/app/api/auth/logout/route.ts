import { NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"

// POST /api/auth/logout - ログアウト
export async function POST() {
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json(
        { error: "Logout failed" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    )
  }
}
