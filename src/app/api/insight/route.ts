import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import { generateInsight } from "@/lib/llm/insight"
import type { Insight } from "@/types"

// GET /api/insight - セッションのインサイト取得
export async function GET(request: NextRequest) {
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

    const { data, error } = await supabase
      .from("insights")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insight: data || null })
  } catch (error) {
    console.error("Failed to fetch insight:", error)
    return NextResponse.json(
      { error: "Failed to fetch insight" },
      { status: 500 }
    )
  }
}

// POST /api/insight - インサイト生成・保存
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const { session_id, transcript_text } = body

    if (!session_id || !transcript_text) {
      return NextResponse.json(
        { error: "Session ID and transcript text required" },
        { status: 400 }
      )
    }

    // 既存のインサイトを取得
    const { data: existingInsight } = await supabase
      .from("insights")
      .select("*")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    // 新しいインサイトを生成
    const insight = await generateInsight(
      transcript_text,
      existingInsight || null
    )

    // インサイトを保存
    const { data, error } = await supabase
      .from("insights")
      .insert({
        session_id,
        summary_text: insight.summary_text,
        pain_points: insight.pain_points,
        constraints: insight.constraints,
        stakeholders: insight.stakeholders,
        timeline: insight.timeline,
        sentiment: insight.sentiment,
        budget_hint: insight.budget_hint,
        competitors: insight.competitors,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insight: data })
  } catch (error) {
    console.error("Failed to generate insight:", error)
    return NextResponse.json(
      { error: "Failed to generate insight" },
      { status: 500 }
    )
  }
}
