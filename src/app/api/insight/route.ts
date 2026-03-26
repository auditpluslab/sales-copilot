import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import { generateInsight } from "@/lib/llm/insight"
import type { Insight } from "@/types"
import { isValidUuid } from "@/lib/security/sanitizer"
import { sanitizeInput } from "@/lib/security/sanitizer"
import { getUserId } from "@/lib/auth-server"

// GET /api/insight - セッションのインサイト取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")
    const statsParam = searchParams.get("stats")
    const transcriptParam = searchParams.get("transcript")

    // クライアントから送信された統計情報と文字起こしテキストを解析
    let transcriptLength = 0
    let segmentCount = 0
    let transcriptText = ""

    if (statsParam) {
      try {
        const stats = JSON.parse(decodeURIComponent(statsParam))
        transcriptLength = stats.totalLength || 0
        segmentCount = stats.totalSegments || 0
        console.log('[Insight] Using stats from client:', { segmentCount, transcriptLength })
      } catch (e) {
        console.error('Failed to parse stats param:', e)
      }
    }

    if (transcriptParam) {
      try {
        transcriptText = decodeURIComponent(transcriptParam)
        console.log('[Insight] Using transcript from client:', transcriptText.substring(0, 100))
      } catch (e) {
        console.error('Failed to parse transcript param:', e)
      }
    }

    // 文字起こしテキストがある場合は、LLMを使ってインサイトを生成
    if (transcriptText.length > 50) {
      // 開発環境では認証チェックをスキップ
      const userId = process.env.NODE_ENV === "production" ? await getUserId() : "test-user-id"
      if (process.env.NODE_ENV === "production" && !userId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        )
      }
      console.log('[Insight] Generating insight from transcript using LLM')
      try {
        const insight = await generateInsight(transcriptText, null)
        return NextResponse.json({ insight })
      } catch (error) {
        console.error('Failed to generate insight from LLM:', error)
        // LLMエラー時はフォールバック
      }
    }

    // 開発環境では動的なモックデータを返す（フォールバック）
    if (process.env.NODE_ENV !== "production") {

      // 文字起こしの長さに基づいて動的なインサイトを生成
      const hasContent = transcriptLength > 50 || segmentCount > 2
      const hasModerateContent = transcriptLength > 200 || segmentCount > 5
      const hasSubstantialContent = transcriptLength > 500 || segmentCount > 10

      const summary = hasSubstantialContent
        ? `会議が進行中です。現在${segmentCount}件の発言があり、文字起こしテキストは約${transcriptLength}文字です。導入に向けた具体的な検討が進んでおり、技術的な要件や予算について議論が行われています。`
        : hasModerateContent
        ? `会議が始まりました。現在${segmentCount}件の発言があり、文字起こしテキストは約${transcriptLength}文字です。導入の目的や期待される効果についての議論が行われています。`
        : '会議の準備ができました。発言があると、リアルタイムで文字起こしされ、AIが分析してインサイトと提案を表示します。'

      const painPoints = []
      if (hasContent) {
        painPoints.push({ description: '導入コストの抑制が重要な課題', impact: 'high', priority: 1 })
      }
      if (hasModerateContent) {
        painPoints.push({ description: '短期間での導入実績の示が必要', impact: 'medium', priority: 2 })
      }
      if (hasSubstantialContent) {
        painPoints.push({ description: '既存システムとの統合が課題', impact: 'medium', priority: 3 })
      }

      const constraints = []
      if (hasContent) {
        constraints.push({ type: 'budget', description: '予算上限がある' })
      }
      if (hasModerateContent) {
        constraints.push({ type: 'timeline', description: '導入時期に制約あり' })
      }
      if (hasSubstantialContent) {
        constraints.push({ type: 'technical', description: '既存システムとの連携が必要' })
      }

      const stakeholders = []
      if (hasModerateContent) {
        stakeholders.push({ name: 'プロジェクトリーダー', role: '企画部', attitude: 'champion', influence: 'high' })
      }
      if (hasContent) {
        stakeholders.push({ name: '技術担当者', role: '情報システム部', attitude: 'neutral', influence: 'medium' })
      }
      if (hasSubstantialContent) {
        stakeholders.push({ name: '財務担当者', role: '経理部', attitude: 'blocker', influence: 'medium' })
      }

      console.log(`[Mock Insight] Generated: segments=${segmentCount}, length=${transcriptLength}, items=${painPoints.length + constraints.length + stakeholders.length}`)

      return NextResponse.json({
        insight: {
          id: `mock-insight-${sessionId}-${Date.now()}`,
          session_id: sessionId || 'mock-session-id',
          summary_text: summary,
          pain_points: painPoints.length > 0 ? painPoints : [{ description: '導入に向けた課題整理', impact: 'medium', priority: 1 }],
          constraints: constraints.length > 0 ? constraints : [{ type: 'timeline', description: '導入時期の検討' }],
          stakeholders: stakeholders.length > 0 ? stakeholders : [{ name: '意思決定者', role: '経営層', attitude: 'neutral', influence: 'high' }],
          sentiment: hasSubstantialContent ? 'positive' : 'neutral',
          timeline: '未定',
          budget_hint: null,
          competitors: [],
          created_at: new Date().toISOString(),
        }
      })
    }

    // 認証チェック
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const supabase = createClient()

    // UUIDバリデーション（13行目で宣言されたsessionIdを使用）
    if (!sessionId || !isValidUuid(sessionId)) {
      return NextResponse.json(
        { error: "Valid Session ID required" },
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

    // セッションがユーザーに属しているか確認
    if (data) {
      const { data: session } = await supabase
        .from("sessions")
        .select("user_id")
        .eq("id", sessionId)
        .single()

      if (!session || session.user_id !== userId) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        )
      }
    }

    if (error && error.code !== "PGRST116") {
      console.error("Database query failed:", error)
      return NextResponse.json({ error: "Failed to fetch insight" }, { status: 500 })
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
    // 認証チェック
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    const supabase = createClient()
    const body = await request.json()
    const { session_id, transcript_text } = body

    // 入力バリデーション
    if (!session_id || !transcript_text) {
      return NextResponse.json(
        { error: "Session ID and transcript text required" },
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
    const sanitizedTranscript = sanitizeInput(transcript_text, { maxLength: 50000 })

    // セッションがユーザーに属しているか確認
    const { data: session } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", session_id)
      .single()

    if (!session || session.user_id !== userId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
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
      sanitizedTranscript,
      existingInsight || null
    )

    // インサイトを保存
    const { data, error } = await supabase
      .from("insights")
      .insert({
        session_id,
        summary_text: sanitizeInput(insight.summary_text, { maxLength: 5000 }),
        pain_points: insight.pain_points,
        constraints: insight.constraints,
        stakeholders: insight.stakeholders,
        timeline: insight.timeline,
        sentiment: insight.sentiment,
        budget_hint: insight.budget_hint ? sanitizeInput(insight.budget_hint, { maxLength: 500 }) : null,
        competitors: insight.competitors || [],
      })
      .select()
      .single()

    if (error) {
      console.error("Database insert failed:", error)
      return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 })
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
