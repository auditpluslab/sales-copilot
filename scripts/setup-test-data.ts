/**
 * CI環境用テストデータセットアップスクリプト
 *
 * 使用方法:
 *   tsx scripts/setup-test-data.ts
 *
 * 環境変数:
 *   - DATABASE_URL: Supabaseデータベース接続URL
 *   - TEST_SESSION_ID: テスト用セッションID（デフォルト: テスト用UUID）
 */

import { createClient } from "@supabase/supabase-js"

// テスト用セッションID
const TEST_SESSION_ID = process.env.TEST_SESSION_ID || "00000000-0000-0000-0000-000000000001"

// テスト用トランスクリプトデータ
const testTranscripts = [
  {
    id: "test-transcript-001",
    session_id: TEST_SESSION_ID,
    ts_start: 1000,
    ts_end: 3000,
    text: "本日はお時間をいただきありがとうございます。弊社のサービスについてご説明させていただきます。",
    is_final: true,
    speaker: "user",
    confidence: 0.95,
    source: "test",
    created_at: new Date().toISOString(),
  },
  {
    id: "test-transcript-002",
    session_id: TEST_SESSION_ID,
    ts_start: 4000,
    ts_end: 7000,
    text: "導入の目的と期待される効果について具体的にお聞かせいただけますか？",
    is_final: true,
    speaker: "agent",
    confidence: 0.92,
    source: "test",
    created_at: new Date().toISOString(),
  },
  {
    id: "test-transcript-003",
    session_id: TEST_SESSION_ID,
    ts_start: 8000,
    ts_end: 12000,
    text: "導入効果の早期可視化と、運用コストの削減を目的としています。",
    is_final: true,
    speaker: "user",
    confidence: 0.98,
    source: "test",
    created_at: new Date().toISOString(),
  },
]

// テスト用提案データ
const testSuggestions = [
  {
    id: "test-suggestion-001",
    session_id: TEST_SESSION_ID,
    question: "導入の目的と期待される効果について具体的にお聞かせいただけますか？",
    proposal: "導入効果の早期可視化と、運用コストの削減を目的としています。",
    category: "cost-reduction",
    priority: 3,
    confidence: "high",
    is_pinned: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "test-suggestion-002",
    session_id: TEST_SESSION_ID,
    question: "導入の目的と期待される効果について具体的にお聞かせいただけますか？",
    proposal: "導入効果の早期可視化を通じて、投資対効果を迅速に評価したいと考えています。",
    category: "roi-visualization",
    priority: 2,
    confidence: "medium",
    is_pinned: false,
    created_at: new Date().toISOString(),
  },
]

// テスト用セッションデータ
const testSession = {
  id: TEST_SESSION_ID,
  client_id: null,
  title: "包括的テスト会議",
  status: "active",
  started_at: new Date().toISOString(),
  ended_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

async function setupTestData() {
  console.log("🔧 Setting up test data for CI environment...")

  // Supabaseクライアントを作成（サービスロールキーを使用）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // 既存データを削除
    console.log("🗑️  Cleaning up existing test data...")
    await supabase.from("transcript_segments").delete().eq("session_id", TEST_SESSION_ID)
    await supabase.from("suggestions").delete().eq("session_id", TEST_SESSION_ID)
    await supabase.from("sessions").delete().eq("id", TEST_SESSION_ID)

    // セッションを作成
    console.log("📝 Creating test session...")
    const { error: sessionError } = await supabase.from("sessions").insert(testSession)
    if (sessionError) {
      console.error("Failed to create session:", sessionError)
      throw sessionError
    }

    // トランスクリプトを挿入
    console.log("📝 Inserting test transcripts...")
    const { error: transcriptError } = await supabase
      .from("transcript_segments")
      .insert(testTranscripts)

    if (transcriptError) {
      console.error("Failed to insert transcripts:", transcriptError)
      throw transcriptError
    }

    // 提案を挿入
    console.log("📝 Inserting test suggestions...")
    const { error: suggestionsError } = await supabase
      .from("suggestions")
      .insert(testSuggestions)

    if (suggestionsError) {
      console.error("Failed to insert suggestions:", suggestionsError)
      throw suggestionsError
    }

    console.log("✅ Test data setup completed successfully!")
    console.log(`   Session ID: ${TEST_SESSION_ID}`)
    console.log(`   Transcripts: ${testTranscripts.length}`)
    console.log(`   Suggestions: ${testSuggestions.length}`)

    return {
      success: true,
      sessionId: TEST_SESSION_ID,
    }
  } catch (error) {
    console.error("❌ Failed to setup test data:", error)
    throw error
  }
}

// メイン実行
async function main() {
  try {
    await setupTestData()
    process.exit(0)
  } catch (error) {
    console.error("Setup failed:", error)
    process.exit(1)
  }
}

main()
