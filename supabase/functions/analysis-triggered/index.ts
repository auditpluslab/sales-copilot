// 定期分析トリガー
// 直近90秒の文字起こしを取得して、AIでインサイトを生成

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifySupabaseJWT } from "../_shared/jwt"

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // JWTトークン検証
    const authHeader = req.headers.get('authorization')
    const apiKey = req.headers.get('apikey')

    if (!authHeader || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization or apikey header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // apikeyがSupabaseのキーであることを確認
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (apiKey !== supabaseAnonKey && apiKey !== supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid apikey' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // JWTトークンを抽出・検証
    const token = authHeader.replace('Bearer ', '')
    const jwtSecret = Deno.env.get('JWT_SECRET') || ''

    if (jwtSecret) {
      const payload = await verifySupabaseJWT(token, jwtSecret)
      if (!payload) {
        return new Response(
          JSON.stringify({ error: 'Invalid JWT token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { sessionId, triggerType, userId } = await req.json()

    if (!sessionId || !userId) {
      return new Response(
        JSON.stringify({ error: 'sessionId and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Analysis triggered for session ${sessionId}: ${triggerType}`)

    // Supabaseクライアントを作成
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // セッションがユーザーに属しているか確認
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", sessionId)
      .single()

    if (sessionError || !session || session.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 直近90秒の文字起こしを取得
    const cutoffTime = Date.now() - 90000
    const { data: recentSegments, error: segmentsError } = await supabase
      .from("transcript_segments")
      .select("text, ts_start, is_final")
      .eq("session_id", sessionId)
      .gte("created_at", new Date(cutoffTime).toISOString())
      .order("ts_start", { ascending: true })

    if (segmentsError) {
      console.error("Failed to fetch segments:", segmentsError)
      return new Response(
        JSON.stringify({ error: segmentsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 既存のインサイトを取得
    const { data: existingInsights, error: insightsError } = await supabase
      .from("insights")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle()

    if (insightsError) {
      console.error("Failed to fetch insights:", insightsError)
    }

    // テキストを結合
    const transcriptText = (recentSegments || []).map((s: { text: string }) => s.text).join(" ")

    if (transcriptText.length > 0) {
      // AIでインサイト生成
      const glmApiKey = Deno.env.get('GLM_API_KEY')

      let insight
      if (glmApiKey) {
        // GLM APIを呼び出してインサイト生成
        try {
          const prompt = `以下の会議文字起こしから、営業ヒアリングのインサイトを抽出してください：
${transcriptText}

以下のJSON形式で出力してください：
{
  "summary_text": "会議の要約",
  "pain_points": [{"description": "課題", "impact": "high/medium/low", "evidence": "根拠"}],
  "constraints": ["制約事項"],
  "stakeholders": ["ステークホルダー"],
  "timeline": "タイムライン",
  "sentiment": "positive/neutral/negative",
  "budget_hint": "予算のヒント",
  "competitors": ["競合他社"]
}`

          const glmResponse = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${glmApiKey}`
            },
            body: JSON.stringify({
              model: "glm-4-flash",
              messages: [
                { role: "user", content: prompt }
              ],
              temperature: 0.3
            })
          })

          if (glmResponse.ok) {
            const glmData = await glmResponse.json()
            const content = glmData.choices[0].message.content

            // JSONをパース
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              insight = JSON.parse(jsonMatch[0])
            } else {
              throw new Error("Failed to parse AI response")
            }
          } else {
            throw new Error("GLM API error")
          }
        } catch (error) {
          console.error("AI analysis failed:", error)
          // エラー時はフォールバック
          insight = {
            summary_text: `会議の要約: ${transcriptText.slice(0, 200)}...`,
            pain_points: [
              {
                description: "文字起こしから抽出された課題",
                impact: "medium" as const,
                evidence: transcriptText.slice(0, 100)
              }
            ],
            constraints: [],
            stakeholders: [],
            timeline: null,
            sentiment: "neutral" as const,
            budget_hint: null,
            competitors: [],
          }
        }
      } else {
        // GLM APIキーがない場合は簡易版
        insight = {
          summary_text: `会議の要約: ${transcriptText.slice(0, 200)}...`,
          pain_points: [
            {
              description: "文字起こしから抽出された課題",
              impact: "medium" as const,
              evidence: transcriptText.slice(0, 100)
            }
          ],
          constraints: [],
          stakeholders: [],
          timeline: null,
          sentiment: "neutral" as const,
          budget_hint: null,
          competitors: [],
        }
      }

      // インサイトをDBに保存
      const { error: upsertError } = await supabase
        .from("insights")
        .upsert({
          ...insight,
          session_id: sessionId,
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error("Failed to save insight:", upsertError)
        return new Response(
          JSON.stringify({ error: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Insight generated successfully',
          insight
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'No transcript to analyze'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
