import { inngest } from "@/lib/inngest/client"
import { createServerClient } from "@/lib/db/supabase"
import { generateInsight } from "@/lib/llm/insight"

// ============================================
// セッション開始時の初期化処理
// ============================================
export const sessionStarted = inngest.createFunction(
  { id: "session-started" },
  { event: "session/started" },
  async ({ event }) => {
    const { sessionId } = event.data as { sessionId: string }

    console.log(`Session started: ${sessionId}`)

    // 初期分析ジョブをスケジュール（90秒後）
    await inngest.send({
      name: "analysis/triggered",
      data: {
        sessionId,
        triggerType: "interval",
      },
    })

    return { success: true }
  }
)

// ============================================
// 文字起こし受信時の処理
// ============================================
export const transcriptReceived = inngest.createFunction(
  { id: "transcript-received" },
  { event: "transcript/received" },
  async ({ event }) => {
    const { sessionId, segment } = event.data as {
      sessionId: string
      segment: {
        id: string
        ts_start: number
        ts_end: number | null
        text: string
        is_final: boolean
        speaker?: string
      }
    }

    const supabase = createServerClient()

    // 文字起こしをDBに保存
    const { error } = await supabase
      .from("transcript_segments")
      .insert({
        id: segment.id,
        session_id: sessionId,
        ts_start: segment.ts_start,
        ts_end: segment.ts_end,
        text: segment.text,
        is_final: segment.is_final,
        speaker: segment.speaker || null,
        source: "browser",
      })

    if (error) {
      console.error("Failed to save transcript segment:", error)
    }

    return { success: !error }
  }
)

// ============================================
// 定期分析トリガー
// ============================================
export const analysisTriggered = inngest.createFunction(
  { id: "analysis-triggered" },
  { event: "analysis/triggered" },
  async ({ event }) => {
    const { sessionId, triggerType } = event.data as {
      sessionId: string
      triggerType: string
    }

    console.log(`Analysis triggered for session ${sessionId}: ${triggerType}`)

    try {
      const supabase = createServerClient()

      // 直近5秒の文字起こしを取得
      const cutoffTime = Date.now() - 5000
      const { data: recentSegments } = await supabase
        .from("transcript_segments")
        .select("text, ts_start, is_final")
        .eq("session_id", sessionId)
        .gte("created_at", new Date(cutoffTime).toISOString())
        .order("ts_start", { ascending: true })

      // 既存のインサイトを取得
      const { data: existingInsights } = await supabase
        .from("insights")
        .select("*")
        .eq("session_id", sessionId)
        .single()

      // テキストを結合
      const transcriptText = (recentSegments || []).map((s: { text: string }) => s.text).join(" ")

      if (transcriptText.length > 0) {
        // インサイト生成
        const insight = await generateInsight(
          transcriptText,
          existingInsights
        )

        // インサイトをDBに保存
        await supabase
          .from("insights")
          .upsert({
            ...insight,
            session_id: sessionId,
            updated_at: new Date().toISOString(),
          })
      }

      return { success: true }
    } catch (error) {
      console.error("Analysis error:", error)
      return { success: false, error: String(error) }
    }
  }
)

// ============================================
// セッション終了時の処理
// ============================================
export const sessionEnded = inngest.createFunction(
  { id: "session-ended" },
  { event: "session/ended" },
  async ({ event }) => {
    const { sessionId } = event.data as { sessionId: string }

    console.log(`Session ended: ${sessionId}`)

    try {
      const supabase = createServerClient()

      // セッションの終了時刻を更新
      await supabase
        .from("sessions")
        .update({ ended_at: new Date().toISOString(), status: "completed" })
        .eq("id", sessionId)

      return { success: true }
    } catch (error) {
      console.error("Session end error:", error)
      return { success: false, error: String(error) }
    }
  }
)
