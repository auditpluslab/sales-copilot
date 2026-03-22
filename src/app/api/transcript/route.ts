import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import type { TranscriptSegment } from "@/types"
import { isValidUuid } from "@/lib/security/sanitizer"
import { sanitizeInput } from "@/lib/security/sanitizer"

// GET /api/transcript - セッションの文字起こし取得
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")
    const limitParam = searchParams.get("limit")
    const offsetParam = searchParams.get("offset")

    // UUIDバリデーション
    if (!sessionId || !isValidUuid(sessionId)) {
      return NextResponse.json(
        { error: "Valid Session ID required" },
        { status: 400 }
      )
    }

    // limitパラメータのバリデーション
    let limit = 100
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
        return NextResponse.json(
          { error: "Invalid limit parameter. Must be between 1 and 1000" },
          { status: 400 }
        )
      }
      limit = parsedLimit
    }

    // offsetパラメータのバリデーション
    let offset = 0
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10)
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return NextResponse.json(
          { error: "Invalid offset parameter. Must be >= 0" },
          { status: 400 }
        )
      }
      offset = parsedOffset
    }

    const { data, error } = await supabase
      .from("transcript_segments")
      .select("*")
      .eq("session_id", sessionId)
      .order("ts_start", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Database query failed:", error)
      return NextResponse.json({ error: "Failed to fetch transcripts" }, { status: 500 })
    }

    return NextResponse.json({ segments: data || [] })
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

    // 入力バリデーション
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    const segment: TranscriptSegment = body

    // 必須フィールドの検証
    if (!segment?.id || !segment?.session_id || !segment?.text) {
      return NextResponse.json(
        { error: "Missing required fields: id, session_id, and text are required" },
        { status: 400 }
      )
    }

    // UUIDバリデーション
    if (!isValidUuid(segment.session_id)) {
      return NextResponse.json(
        { error: "Invalid session ID format" },
        { status: 400 }
      )
    }

    // テキストフィールドのサニタイズ
    const sanitizedText = sanitizeInput(segment.text, { maxLength: 10000 })
    const sanitizedSpeaker = segment.speaker
      ? sanitizeInput(segment.speaker, { maxLength: 100 })
      : null

    const { data, error } = await supabase
      .from("transcript_segments")
      .insert({
        id: segment.id,
        session_id: segment.session_id,
        ts_start: segment.ts_start,
        ts_end: segment.ts_end,
        text: sanitizedText,
        is_final: segment.is_final,
        speaker: sanitizedSpeaker,
        confidence: segment.confidence,
        source: segment.source || "browser",
        created_at: segment.created_at || new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Database insert failed:", error)
      return NextResponse.json({ error: "Failed to save transcript" }, { status: 500 })
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

    // UUIDバリデーション
    if (!sessionId || !isValidUuid(sessionId)) {
      return NextResponse.json(
        { error: "Valid Session ID required" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("transcript_segments")
      .delete()
      .eq("session_id", sessionId)

    if (error) {
      console.error("Database delete failed:", error)
      return NextResponse.json({ error: "Failed to delete transcripts" }, { status: 500 })
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
