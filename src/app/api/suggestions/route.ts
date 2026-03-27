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
        transcriptLength = stats.totalLength || 0
        segmentCount = stats.totalSegments || 0
        console.log('[Suggestions] Using stats from client:', { segmentCount, transcriptLength })
      } catch (e) {
        console.error('Failed to parse stats param:', e)
      }
    }

    if (transcriptParam) {
      try {
        transcriptText = decodeURIComponent(transcriptParam)
        console.log('[Suggestions] Using transcript from client:', transcriptText.substring(0, 100))
      } catch (e) {
        console.error('Failed to parse transcript param:', e)
      }
    }

    // 文字起こしテキストがある場合は、LLMを使って提案を生成
    // 開発環境でもNEXT_PUBLIC_USE_LLM_IN_DEV=trueならLLMを使う
    const useLlmInDev = process.env.NODE_ENV === "production" ||
                        request.headers.get('x-use-llm') === 'true' ||
                        process.env.NEXT_PUBLIC_USE_LLM_IN_DEV === 'true'

    // 開発環境でテストしやすいように、会話テキストが短い場合はテスト用テキストを使用
    const isDev = process.env.NODE_ENV !== "production"
    if (isDev && useLlmInDev && transcriptText.length < 50) {
      console.log('[Suggestions] Using test transcript for development (transcript too short)')
      transcriptText = `
営業担当者: 本日は御社の人事評価制度についてお話しさせてください。まずは、現在の課題から教えていただけますか？

人事担当者: はい、現在大きく2つの課題があります。1つ目は、評価の基準が部署によってバラバラで不公平感があるということ。もう1つは、評価作業自体に時間がかかりすぎているんです。

営業担当者: 具体的には、どのくらいの時間がかかっていますか？

人事担当者: 四半期ごとの評価業務で、部下30名分の評価書を作成するのに約2週間かかっています。各評価書の作成に1時間程度で、合計で30時間くらいです。

営業担当者: なるほど、30時間ですか。評価の件数は年間でどのくらいですか？

人事担当者: 年4回の評価なので、年間120件の評価書を作成することになります。延べ120時間かかっている計算です。
      `.trim()
      console.log('[Suggestions] Test transcript length:', transcriptText.length)
    }

    if (transcriptText.length > 0 && useLlmInDev) {
      // 開発環境では認証チェックをスキップ
      const userId = process.env.NODE_ENV === "production" ? await getUserId() : "test-user-id"
      if (process.env.NODE_ENV === "production" && !userId) {
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

    // 開発環境では動的なモックデータを返す（フォールバック）
    if (process.env.NODE_ENV !== "production") {

      const hasContent = transcriptLength > 50 || segmentCount > 2
      const hasModerateContent = transcriptLength > 200 || segmentCount > 5
      const hasSubstantialContent = transcriptLength > 500 || segmentCount > 10

      // 質問を動的に生成
      const questions = [
        {
          question: '導入の目的と期待される効果について具体的にお聞かせいただけますか？',
          intent: '導入目的の明確化',
          priority: 'high',
          category: 'requirements'
        },
      ]
      if (hasContent) {
        questions.push({
          question: '予算についての制約や要件はありますか？',
          intent: '予算枠の確認',
          priority: 'high',
          category: 'budget'
        })
      }
      if (hasModerateContent) {
        questions.push({
          question: '既存システムとの連携について、どのような要件がありますか？',
          intent: '技術要件の把握',
          priority: 'medium',
          category: 'technical'
        })
      }
      if (hasSubstantialContent) {
        questions.push({
          question: '意思決定のタイミングについて教えていただけますか？',
          intent: '導入時期の確認',
          priority: 'medium',
          category: 'timeline'
        })
      }

      // 提案を動的に生成
      const proposals = [
        {
          title: '導入効果の試算',
          body: `現在${segmentCount}件の発言があります。貴社の現状から想定される効果を試算します。`,
          confidence: hasSubstantialContent ? 'high' : 'medium',
          category: 'value_proposition',
          expected_outcome: '導入検討の加速'
        },
      ]
      if (hasModerateContent) {
        proposals.push({
          title: '導入プランの提案',
          body: '段階的な導入アプローチをご提案します。まずは小規模なパイロットから始め、効果を確認しながら拡大します。',
          confidence: 'medium',
          category: 'implementation',
          expected_outcome: 'リスク低減'
        })
      }
      if (hasSubstantialContent) {
        proposals.push({
          title: '成功事例の共有',
          body: '同業種・同規模の企業での導入事例をご紹介します。具体的な成果として、業務効率化率、コスト削減額などをお示しします。',
          confidence: 'high',
          category: 'social_proof',
          expected_outcome: '信頼性向上'
        })
      }

      console.log(`[Mock Suggestions] Generated: segments=${segmentCount}, length=${transcriptLength}, questions=${questions.length}, proposals=${proposals.length}`)

      return NextResponse.json({
        suggestions: {
          id: `mock-suggestions-${sessionId}-${Date.now()}`,
          session_id: sessionId || 'mock-session-id',
          questions: questions,
          proposals: proposals,
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
