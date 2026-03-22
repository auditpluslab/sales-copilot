import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import { generateSuggestions } from "@/lib/llm/suggestions"
import { isValidUuid } from "@/lib/security/sanitizer"
import { sanitizeInput } from "@/lib/security/sanitizer"

// GET /api/suggestions - セッションの提案取得
export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
      .from("suggestions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      console.error("Database query failed:", error)
      return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 })
    }

    return NextResponse.json({ suggestions: data || null })
  } catch (error) {
    console.error("Failed to fetch suggestions:", error)
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    )
  }
}

// POST /api/suggestions - 提案生成
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const { session_id, insight, transcript_text } = body

    // 入力バリデーション
    if (!session_id || !insight) {
      return NextResponse.json(
        { error: "Session ID and insight required" },
        { status: 400 }
      )
    }

    // UUIDバリデーション
    if (!isValidUuid(session_id)) {
      return NextResponse.json(
        { error: "Invalid session ID format" },
        { status: 400 }
      )
    }

    // transcript_textのサニタイズ
    const sanitizedTranscript = transcript_text
      ? sanitizeInput(transcript_text, { maxLength: 50000 })
      : ""

    // 提案を生成
    const suggestions = await generateSuggestions(insight, sanitizedTranscript)

    // 提案を保存
    const { data, error } = await supabase
      .from("suggestions")
      .insert({
        session_id,
        questions: suggestions.questions,
        proposals: suggestions.proposals,
      })
      .select()
      .single()

    if (error) {
      console.error("Database insert failed:", error)
      return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 })
    }

    return NextResponse.json({ suggestions: data })
  } catch (error) {
    console.error("Failed to generate suggestions:", error)
    return NextResponse.json(
      { error: "Failed to generate suggestions" },
      { status: 500 }
    )
  }
}
