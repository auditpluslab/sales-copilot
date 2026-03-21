import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import { inngest } from "@/lib/inngest/client"

// POST /api/session/complete - セッション完了処理
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const { session_id } = body

    if (!session_id) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      )
    }

    // セッション状態を更新
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Inngestイベントを送信
    await inngest.send({
      name: "session/completed",
      data: { session_id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to complete session:", error)
    return NextResponse.json(
      { error: "Failed to complete session" },
      { status: 500 }
    )
  }
}
