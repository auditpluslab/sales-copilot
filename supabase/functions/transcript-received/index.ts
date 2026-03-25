// 文字起こし受信時の処理
// 受信した文字起こしセグメントをデータベースに保存

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
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') || ''

    if (jwtSecret) {
      const payload = await verifySupabaseJWT(token, jwtSecret)
      if (!payload) {
        return new Response(
          JSON.stringify({ error: 'Invalid JWT token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const { sessionId, segment, userId } = await req.json()

    if (!sessionId || !segment || !userId) {
      return new Response(
        JSON.stringify({ error: 'sessionId, segment, and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // Supabaseクライアントを作成
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
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
