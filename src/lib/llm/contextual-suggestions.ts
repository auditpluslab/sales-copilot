import { chatCompletion } from "./client"
import { createClient } from "@/lib/db/supabase"
import type {
  Insight,
  ConversationHistory,
  CurrentContext,
  EnhancedSuggestions,
  SessionHistory,
  PainPointEvolution,
  InterestEvolution,
  ConcernEvolution,
  DecisionEvolution,
  DeepDiveQuestion,
  SuggestionCard
} from "@/types"

// ============================================
// クライアントの会話履歴を取得
// ============================================

export async function getClientConversationHistory(
  clientId: string,
  limit: number = 10
): Promise<ConversationHistory | null> {
  try {
    const supabase = createClient()

    // クライアントの過去のセッションを取得（新しい順）
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select(`
        id,
        created_at,
        meeting_title,
        insights (
          summary_text,
          pain_points,
          constraints,
          stakeholders,
          sentiment
        )
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !sessions || sessions.length === 0) {
      console.log("[ContextualSuggestions] No history found for client:", clientId)
      return null
    }

    // セッション履歴を構造化
    const sessionHistories: SessionHistory[] = sessions
      .filter(s => s.insights)  // インサイトがあるもののみ
      .map(s => ({
        session_id: s.id,
        date: s.created_at,
        summary: s.insights?.summary_text || "",
        key_topics: extractTopics(s.insights?.summary_text || ""),
        stakeholder_attitudes: extractAttitudes(s.insights?.stakeholders || []),
        pain_points: s.insights?.pain_points || [],
        constraints: s.insights?.constraints || [],
        sentiment: s.insights?.sentiment || "neutral"
      }))

    if (sessionHistories.length === 0) {
      return null
    }

    // 時系列での変化を分析
    const evolution = analyzeEvolution(sessionHistories)

    console.log(`[ContextualSuggestions] Found ${sessionHistories.length} sessions for client ${clientId}`)

    return {
      client_id: clientId,
      sessions: sessionHistories,
      evolution
    }
  } catch (error) {
    console.error("[ContextualSuggestions] Failed to get client history:", error)
    return null
  }
}

// ============================================
// 直近の会話コンテキストを抽出
// ============================================

export function extractCurrentContext(transcript: string): CurrentContext {
  const lines = transcript
    .split("\n")
    .filter(line => line.trim())
    .slice(-10) // 直近10行を取得

  const recentStatements = lines.slice(-5) // 直近5件
  const lastSpeakerStatement = lines[lines.length - 1] || ""

  // キーワード抽出
  const keywords = extractKeywords(recentStatements.join(" "))

  // トピック検出
  const currentTopic = detectCurrentTopic(recentStatements)

  // 興味のサインを検出
  const interestLevel = detectInterestLevel(recentStatements)

  // 引用可能なフレーズを抽出
  const quotedPhrases = extractQuotablePhrases(recentStatements)

  // 緊急度を検出
  const urgency = detectUrgency(recentStatements)

  // 相手の反応を検出
  const speakerReaction = detectSpeakerReaction(recentStatements)

  return {
    recent_statements: recentStatements,
    last_speaker_statement: lastSpeakerStatement,
    current_topic: currentTopic,
    keywords: keywords,
    interest_level: interestLevel,
    quoted_phrases: quotedPhrases,
    urgency: urgency,
    speaker_reaction: speakerReaction
  }
}

// ============================================
// 時系列での変化を分析
// ============================================

function analyzeEvolution(sessions: SessionHistory[]) {
  // 古い順に並べ替えて変化を追跡
  const chronological = [...sessions].reverse()

  return {
    pain_points: extractPainPointsEvolution(chronological),
    interests: extractInterestsEvolution(chronological),
    concerns: extractConcernsEvolution(chronological),
    decisions: extractDecisionsEvolution(chronological)
  }
}

function extractPainPointsEvolution(sessions: SessionHistory[]): PainPointEvolution[] {
  return sessions.map(s => ({
    date: s.date,
    pain_points: s.pain_points
  }))
}

function extractInterestsEvolution(sessions: SessionHistory[]): InterestEvolution[] {
  return sessions.map(s => ({
    date: s.date,
    interests: s.key_topics
  }))
}

function extractConcernsEvolution(sessions: SessionHistory[]): ConcernEvolution[] {
  return sessions.map(s => ({
    date: s.date,
    concerns: s.constraints.map(c => c.description)
  }))
}

function extractDecisionsEvolution(sessions: SessionHistory[]): DecisionEvolution[] {
  // ステークホルダーの態度変化から決定事項を推測
  return sessions.map(s => ({
    date: s.date,
    decisions: Object.entries(s.stakeholder_attitudes)
      .filter(([_, attitude]) => attitude === "champion")
      .map(([name, _]) => `${name}が肯定的`)
  }))
}

// ============================================
// ヘルパー関数
// ============================================

function extractTopics(summary: string): string[] {
  // 簡易的なトピック抽出（実際はもっと高度なNLPを使う）
  const keywords = [
    "予算", "スケジュール", "導入", "PoC", "効果", "コスト",
    "既存システム", "連携", "データ", "AI", "自動化"
  ]

  return keywords.filter(keyword => summary.includes(keyword))
}

function extractAttitudes(stakeholders: any[]): Record<string, string> {
  const attitudes: Record<string, string> = {}
  stakeholders.forEach(s => {
    attitudes[s.name] = s.attitude
  })
  return attitudes
}

function extractKeywords(text: string): string[] {
  // 重要なキーワードを抽出
  const patterns = [
    /予算[^、。]*[円万]/g,
    /期間[^、。]*月/g,
    /[0-9]+ヶ月/g,
    /PoC/g,
    /導入/g,
    /効果/g
  ]

  const keywords: string[] = []
  patterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      keywords.push(...matches)
    }
  })

  return [...new Set(keywords)] // 重複を除去
}

function detectCurrentTopic(statements: string[]): string {
  const text = statements.join(" ")

  // トピックの分類
  if (text.includes("予算") || text.includes("コスト") || text.includes("金額")) {
    return "予算・コスト"
  } else if (text.includes("スケジュール") || text.includes("期間") || text.includes("期限")) {
    return "スケジュール"
  } else if (text.includes("PoC") || text.includes("試験") || text.includes("実証")) {
    return "PoC・実証実験"
  } else if (text.includes("システム") || text.includes("連携") || text.includes("既存")) {
    return "技術・システム"
  } else if (text.includes("導入") || text.includes("開始") || text.includes("始め")) {
    return "導入計画"
  }

  return "一般的な相談"
}

function detectInterestLevel(statements: string[]): "high" | "medium" | "low" {
  const text = statements.join(" ")

  const positiveSignals = [
    "興味あり", "詳しく", "具体的", "それいい", "やってみたい",
    "検討したい", "聞きたい", "知りたい"
  ]

  const negativeSignals = [
    "難しい", "無理", "できない", "微妙", "いらない",
    "興味ない", "今はまだ"
  ]

  let positiveCount = 0
  let negativeCount = 0

  positiveSignals.forEach(signal => {
    if (text.includes(signal)) positiveCount++
  })

  negativeSignals.forEach(signal => {
    if (text.includes(signal)) negativeCount++
  })

  if (positiveCount >= 2) return "high"
  if (negativeCount >= 1) return "low"
  return "medium"
}

function extractQuotablePhrases(statements: string[]): string[] {
  // 引用に適したフレーズを抽出（数字や具体的な表現を含むもの）
  return statements
    .filter(s => {
      // 具体的な数字や表現を含むもの
      return s.match(/[0-9]+/) || s.includes("万円") || s.includes("ヶ月")
    })
    .slice(-3) // 直近3件
}

function detectUrgency(statements: string[]): "high" | "medium" | "low" {
  const text = statements.join(" ")

  if (text.includes("急ぎ") || text.includes("早急") || text.includes("今週") || text.includes("来週")) {
    return "high"
  } else if (text.includes("今月中") || text.includes("来月")) {
    return "medium"
  }

  return "low"
}

function detectSpeakerReaction(statements: string[]): string {
  if (statements.length === 0) return ""

  const lastStatement = statements[statements.length - 1]

  // 反応を分類
  if (lastStatement.includes("そうですね") || lastStatement.includes("確かに")) {
    return "肯定的"
  } else if (lastStatement.includes("でも") || lastStatement.includes("しかし")) {
    return "懸念あり"
  } else if (lastStatement.includes("?") || lastStatement.includes("？")) {
    return "質問"
  }

  return "中立"
}

// ============================================
// 文脈を考慮した提案生成
// ============================================

export async function generateContextualSuggestions(params: {
  clientId?: string
  currentTranscript: string
  currentInsight: Insight
}): Promise<EnhancedSuggestions> {

  // 1. クライアントIDがある場合は履歴を取得
  let history: ConversationHistory | null = null
  if (params.clientId) {
    history = await getClientConversationHistory(params.clientId)
  }

  // 2. 直近の会話コンテキストを抽出
  const currentContext = extractCurrentContext(params.currentTranscript)

  // 3. プロンプトを構築
  const prompt = buildContextualPrompt({
    history,
    currentContext,
    currentInsight: params.currentInsight
  })

  // 4. LLMで生成
  const result = await chatCompletion([
    {
      role: "system",
      content: CONTEXTUAL_SUGGESTION_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: prompt,
    },
  ], {
    temperature: 0.1,  // より決定論的に
    maxTokens: 3000
  })

  // 5. 結果をパース
  let content = result.content || "{}"
  // LLMの出力からMarkdownコードブロックを取り除く
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  let parsed: any

  try {
    parsed = JSON.parse(content)
  } catch (e) {
    console.error("[ContextualSuggestions] Failed to parse LLM response:", e)
    console.error("[ContextualSuggestions] Content was:", content.substring(0, 200))
    // フォールバック
    parsed = {
      questions: [],
      proposals: []
    }
  }

  return {
    questions: parsed.questions || [],
    proposals: parsed.proposals || [],
    context_used: {
      history_sessions_used: history?.sessions.length || 0,
      recent_statements_used: currentContext.recent_statements.length,
      evolution_detected: !!history && history.sessions.length > 1
    }
  }
}

// ============================================
// プロンプト構築
// ============================================

function buildContextualPrompt(params: {
  history: ConversationHistory | null
  currentContext: CurrentContext
  currentInsight: Insight
}): string {

  let prompt = ""

  // 過去の会議履歴がある場合
  if (params.history && params.history.sessions.length > 0) {
    prompt += "## クライアントの会話履歴（これまでの経緯）\n\n"

    // 直近3回の会議を表示
    const recentSessions = params.history.sessions.slice(0, 3)

    recentSessions.forEach((session, index) => {
      const date = new Date(session.date).toLocaleDateString("ja-JP")
      prompt += `### ${index + 1}回目の会議（${date}）\n`
      prompt += `- トピック：${session.key_topics.join("、")}\n`
      prompt += `- 要約：${session.summary.substring(0, 100)}...\n`
      if (session.pain_points.length > 0) {
        prompt += `- 課題：${session.pain_points.map(p => p.description).join("、")}\n`
      }
      if (session.constraints.length > 0) {
        prompt += `- 制約：${session.constraints.map(c => c.description).join("、")}\n`
      }
      prompt += "\n"
    })

    // 時系列での変化
    if (params.history.evolution) {
      prompt += "### 時系列での変化\n\n"

      if (params.history.evolution.pain_points.length > 1) {
        prompt += "**課題の変遷：**\n"
        params.history.evolution.pain_points.slice(0, 3).forEach(evo => {
          const date = new Date(evo.date).toLocaleDateString("ja-JP")
          const pains = evo.pain_points.map(p => p.description).join("、")
          prompt += `- ${date}: ${pains || "特になし"}\n`
        })
        prompt += "\n"
      }

      if (params.history.evolution.interests.length > 1) {
        prompt += "**興味の移り変わり：**\n"
        params.history.evolution.interests.slice(0, 3).forEach(evo => {
          const date = new Date(evo.date).toLocaleDateString("ja-JP")
          const interests = evo.interests.join("、")
          prompt += `- ${date}: ${interests || "特になし"}\n`
        })
        prompt += "\n"
      }
    }
  }

  // 直近の会話（プロンプトインジェクション対策：ユーザー入力をエスケープ）
  prompt += "## 直前の会話（直近5件の発言）\n\n"
  params.currentContext.recent_statements.forEach(stmt => {
    // 特殊文字をエスケープしてプロンプトインジェクションを防止
    const escaped = stmt
      .replace(/"/g, '\\"')  // クォートをエスケープ
      .replace(/\[/g, '\\[')  // 角括弧をエスケープ
      .replace(/\]/g, '\\]')
      .replace(/`/g, '\\`')   // バッククォートをエスケープ
      .substring(0, 200)      // 長さを制限
    prompt += `「${escaped}」\n`
  })
  prompt += "\n"

  // 相手が使った言葉（引用可能）
  if (params.currentContext.quoted_phrases.length > 0) {
    prompt += "### 相手が使った言葉（引用可能）\n\n"
    params.currentContext.quoted_phrases.forEach(phrase => {
      prompt += `- "${phrase}"\n`
    })
    prompt += "\n"
  }

  // 現在の状況
  prompt += "### 現在の状況\n\n"
  prompt += `- トピック：${params.currentContext.current_topic}\n`
  prompt += `- 興味のレベル：${params.currentContext.interest_level}\n`
  prompt += `- 緊急度：${params.currentContext.urgency}\n`
  if (params.currentContext.speaker_reaction) {
    prompt += `- 直前の反応：${params.currentContext.speaker_reaction}\n`
  }
  prompt += "\n"

  // 指示
  prompt += "## 重要な指示\n\n"
  prompt += "1. **過去の会話と直近の会話を組み合わせること**\n"
  prompt += "   - 過去の会話から：クライアントが一貫して重視していること\n"
  prompt += "   - 直近の会話から：今の緊急度と具体的条件\n\n"

  prompt += "2. **直前の発言に必ず言及すること**\n"
  prompt += "   - 相手が使った言葉を引用すること\n"
  prompt += "   - 「今話していること」に関連した提案にすること\n\n"

  prompt += "3. **抽象的な提案は避けること**\n"
  prompt += "   - 具体的なアクションを提案すること\n"
  prompt += "   - 数字や期間を含めること\n\n"

  prompt += "4. **履歴から分かる傾向を活用すること**\n"
  if (params.history && params.history.sessions.length > 1) {
    prompt += "   - クライアントが一貫して出している懸念には配慮する\n"
    prompt += "   - 過去に肯定的だったアプローチを参考にする\n"
  }
  prompt += "\n"

  // 出力形式の再確認
  prompt += "## 出力形式\n\n"
  prompt += JSON.stringify({
    questions: [
      {
        question: "質問文（短く、読み上げ可能）",
        intent: "なぜこの質問を聞くのか",
        category: "constraint | value | timeline | budget | decision | competition",
        priority: 1,
        evidence: "根拠となる発話（必ず直近の会話から引用）"
      }
    ],
    proposals: [
      {
        title: "提案名",
        body: "提案の詳細説明",
        reason: "なぜ今この提案が自然か（履歴と直近会話の両方から根拠）",
        expected_value: "期待される効果",
        next_step_phrase: "次の一言",
        evidence: "根拠となる発話（必ず直近の会話から引用）",
        confidence: "high | medium | low",
        rank: 1
      }
    ]
  }, null, 2)

  return prompt
}

// ============================================
// システムプロンプト
// ============================================

const CONTEXTUAL_SUGGESTION_SYSTEM_PROMPT = `あなたは日本語の営業会議支援エキスパートです。

クライアントの**過去の会議履歴**と**直近の会話**の両方を考慮して、最適な質問と提案を生成してください。

## 重要な原則

1. **文脈の継続性**: 過去の会話で一貫して出ているテーマや懸念を尊重する
2. **現在の緊急性**: 直近の会話の緊急度と具体的条件に即応する
3. **具体的な提案**: 抽象的な表現を避け、数字・期間・アクションを明示する
4. **相手の言葉の引用**: 直近の発言を引用し、会話の連続性を示す

## 出力の品質基準

- 質問は最大3つまで（優先順位順）
- 提案は最大2つまで（優先順位順）
- 各項目には必ず「根拠となる発話」を含める（直近の会話から）
- 過去の履歴と現在の状況を結びつけて説明する

## 悪い例

「導入プランをご提案します」
→ 抽象的すぎる、会話の流れを無視、履歴を考慮していない

## 良い例

「先ほど『予算の枠は300万円程度』とのことでしたが、過去3回の会議でも『段階的な導入』に関心を示されていたので、まずは150万円から始めて、効果を見ながら拡大するプランはいかがでしょうか？3ヶ月後の会議で次のステップを検討できます」

→ 直前の発言を引用（300万円）
→ 過去の履歴を考慮（段階的導入への関心）
→ 具体的な数字と期間（150万円、3ヶ月後）
→ 会話の流れに自然に続いている
`
