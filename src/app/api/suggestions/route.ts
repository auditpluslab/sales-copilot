import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/db/supabase"
import { generateSuggestions } from "@/lib/llm/suggestions"
import { generateContextualSuggestions } from "@/lib/llm/contextual-suggestions"
import { generateInsight } from "@/lib/llm/insight"
import { isValidUuid } from "@/lib/security/sanitizer"
import { sanitizeInput } from "@/lib/security/sanitizer"
import { getUserId } from "@/lib/auth-server"

// GET /api/suggestions - セッションの提案取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")
    const clientId = searchParams.get("client_id")  // クライアントIDを追加
    const statsParam = searchParams.get("stats")
    const transcriptParam = searchParams.get("transcript")

    // クライアントから送信された統計情報と文字起こしテキストを解析
    let transcriptLength = 0
    let segmentCount = 0
    let transcriptText = ""

    if (statsParam) {
      try {
        const stats = JSON.parse(decodeURIComponent(statsParam))

        // 型チェック
        if (stats.totalLength !== undefined) {
          const length = Number(stats.totalLength)
          if (!isNaN(length) && length >= 0) {
            transcriptLength = length
          }
        }

        if (stats.totalSegments !== undefined) {
          const segments = Number(stats.totalSegments)
          if (!isNaN(segments) && segments >= 0) {
            segmentCount = segments
          }
        }

        console.log('[Suggestions] Using stats from client:', { segmentCount, transcriptLength })
      } catch (e) {
        console.error('Failed to parse stats param:', e)
      }
    }

    if (transcriptParam) {
      try {
        const decoded = decodeURIComponent(transcriptParam)
        // サニタイズ（長さ制限と危険なパターンを検出）
        transcriptText = sanitizeInput(decoded, { maxLength: 50000 })
        console.log('[Suggestions] Using transcript from client:', transcriptText.substring(0, 100))
      } catch (e) {
        console.error('Failed to parse transcript param:', e)
      }
    }

    // 文字起こしテキストがある場合は、LLMを使って提案を生成
    if (transcriptText.length > 0) {
      // 開発環境では認証チェックをスキップ（USE_LLM_IN_DEVがtrueの場合のみ）
      const shouldSkipAuth = process.env.NODE_ENV !== "production" &&
                            process.env.NEXT_PUBLIC_USE_LLM_IN_DEV === 'true'

      const userId = shouldSkipAuth ? "test-user-id" : await getUserId()

      if (!shouldSkipAuth && !userId) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        )
      }
      console.log('[Suggestions] Generating suggestions from transcript using LLM')
      console.log('[Suggestions] Transcript length:', transcriptText.length)
      console.log('[Suggestions] Client ID:', clientId)
      try {
        // インサイトを生成
        const insight = await generateInsight(transcriptText, null)

        // クライアントIDがある場合は、履歴を考慮した提案生成
        if (clientId && isValidUuid(clientId)) {
          console.log('[Suggestions] Using contextual suggestions with client history')
          const enhancedSuggestions = await generateContextualSuggestions({
            clientId,
            currentTranscript: transcriptText,
            currentInsight: insight
          })
          console.log('[Suggestions] Generated with context:', enhancedSuggestions.context_used)
          return NextResponse.json({
            suggestions: {
              questions: enhancedSuggestions.questions,
              proposals: enhancedSuggestions.proposals,
              context_used: enhancedSuggestions.context_used
            }
          })
        } else {
          // 従来の提案生成（フォールバック）
          console.log('[Suggestions] Using standard suggestions (no client history)')
          const suggestions = await generateSuggestions(insight, transcriptText)
          return NextResponse.json({ suggestions })
        }
      } catch (error) {
        console.error('Failed to generate suggestions from LLM:', error)
        // LLMエラー時はフォールバック
      }
    }

    // 会話がまだない場合は空のレスポンスを返す
    if (transcriptLength === 0 && segmentCount === 0 && transcriptText.length === 0) {
      console.log('[Suggestions] No conversation yet, returning empty response')
      return NextResponse.json({
        suggestions: {
          questions: [],
          proposals: [],
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

    // UUIDバリデーション（12行目で宣言されたsessionIdを使用）
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
    const { session_id, client_id, insight, transcript_text } = body

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

    if (client_id && !isValidUuid(client_id)) {
      return NextResponse.json(
        { error: "Invalid client ID format" },
        { status: 400 }
      )
    }

    // transcript_textのサニタイズ
    const sanitizedTranscript = transcript_text
      ? sanitizeInput(transcript_text, { maxLength: 50000 })
      : ""

    // セッションがユーザーに属しているか確認
    const { data: session } = await supabase
      .from("sessions")
      .select("user_id, client_id")
      .eq("id", session_id)
      .single()

    if (!session || session.user_id !== userId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // 提案を生成（クライアント履歴を考慮）
    const effectiveClientId = client_id || session.client_id
    let suggestions

    if (effectiveClientId && isValidUuid(effectiveClientId)) {
      console.log('[Suggestions] Using contextual suggestions with client history')
      const enhancedSuggestions = await generateContextualSuggestions({
        clientId: effectiveClientId,
        currentTranscript: sanitizedTranscript,
        currentInsight: insight
      })
      console.log('[Suggestions] Generated with context:', enhancedSuggestions.context_used)
      suggestions = {
        questions: enhancedSuggestions.questions,
        proposals: enhancedSuggestions.proposals
      }
    } else {
      // 従来の提案生成（フォールバック）
      console.log('[Suggestions] Using standard suggestions (no client history)')
      suggestions = await generateSuggestions(insight, sanitizedTranscript)
    }

    // 提案を保存（LLM出力の検証）
    if (!Array.isArray(suggestions.questions) || !Array.isArray(suggestions.proposals)) {
      console.error('[Suggestions] Invalid suggestions structure:', {
        questionsType: typeof suggestions.questions,
        proposalsType: typeof suggestions.proposals
      })
      return NextResponse.json(
        { error: "Invalid suggestions structure from LLM" },
        { status: 500 }
      )
    }

    // 各質問の構造を検証
    for (const q of suggestions.questions) {
      if (!q || typeof q !== 'object') {
        console.error('[Suggestions] Invalid question item:', q)
        return NextResponse.json(
          { error: "Invalid question structure" },
          { status: 500 }
        )
      }
      if (!q.question || typeof q.question !== 'string') {
        console.error('[Suggestions] Question missing required field:', q)
        return NextResponse.json(
          { error: "Question missing required 'question' field" },
          { status: 500 }
        )
      }
    }

    // 各提案の構造を検証
    for (const p of suggestions.proposals) {
      if (!p || typeof p !== 'object') {
        console.error('[Suggestions] Invalid proposal item:', p)
        return NextResponse.json(
          { error: "Invalid proposal structure" },
          { status: 500 }
        )
      }
      if (!p.title || typeof p.title !== 'string') {
        console.error('[Suggestions] Proposal missing required field:', p)
        return NextResponse.json(
          { error: "Proposal missing required 'title' field" },
          { status: 500 }
        )
      }
    }

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
