import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import type { TranscriptSegment } from "@/types"

// GET /api/transcript - セッションの文字起こし取得
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("transcript_segments")
      .select("*")
      .eq("session_id", sessionId)
      .order("ts_start", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ segments: data })
  } catch (error) {
    console.error("Failed to fetch transcripts:", error)
    return NextResponse.json(
      { error: "Failed to fetch transcripts" },
      { status: 500 }
    )
  }
}

// POST /api/transcript - 文字起こしセグメント保存
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const segment: TranscriptSegment = body

    const { data, error } = await supabase
      .from("transcript_segments")
      .insert({
        id: segment.id,
        session_id: segment.session_id,
        ts_start: segment.ts_start,
        ts_end: segment.ts_end,
        text: segment.text,
        is_final: segment.is_final,
        speaker: segment.speaker,
        confidence: segment.confidence,
        created_at: segment.created_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ segment: data })
  } catch (error) {
    console.error("Failed to save transcript:", error)
    return NextResponse.json(
      { error: "Failed to save transcript" },
      { status: 500 }
    )
  }
}

// DELETE /api/transcript - 文字起こし削除（セッション単位）
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("transcript_segments")
      .delete()
      .eq("session_id", sessionId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete transcripts:", error)
    return NextResponse.json(
      { error: "Failed to delete transcripts" },
      { status: 500 }
    )
  }
}
