import { chatCompletion } from "./client"
import type { Insight, SessionSummary, NextAction, TranscriptSegment } from "@/types"

const SUMMARY_SYSTEM_PROMPT = `あなたは日本語の営業会議サマリー生成アシスタントです。
会議が終了したら、この要約を構造化して生成してください。

## 入力
- セッションID
- 全テキストの文字起こし内容
- 顧客情報
- 直近のローリングサマリー情報

## 出力内容
- 会議の要約（2-3文）
- 抽出された課題・制約・ステークホルダー
- 次に聞くべき深掘り質問（最大3つ）
- 提案仮説（最大2件）
- 未確認事項
- 次のアクションアイテム（最大3件）

## 出力形式
{
  "summary_text": "会議の要約（2〜3文）",
  "key_points": ["主要なポイント1", "主要なポイント2"],
  "pain_points": [
    {
      "description": "課題の説明",
      "impact": "high | medium | low",
      "evidence": "根拠となる発話"
    }
  ],
  "constraints": [
    {
      "type": "budget | timeline | technical | organizational | resource",
      "description": "制約の説明",
      "evidence": "根拠となる発話"
    }
  ],
  "stakeholders": [
    {
      "name": "氏名",
      "role": "役割",
      "attitude": "champion | neutral | skeptical | blocker | unknown",
      "notes": "補足情報"
    }
  ],
  "timeline": {
    "urgency": "high | medium | low",
    "deadline": "期限（ISO形式の場合）",
    "milestones": ["マイルストーンの配列"]
  },
  "sentiment": "positive | neutral | negative | mixed",
  "next_actions": [
    {
      "action": "アクション内容",
      "owner": "担当者",
      "deadline": "期限",
      "priority": "high | medium | low"
    }
  ],
  "open_questions": ["未確認事項1", "未確認事項2"],
  "email_draft": "次回のメール下書き（必要な場合）"
}

## 注意事項
- 会議の目的に合致した内容にする
- 根拠となる発話を確認する
- 明確化率を高める
- 使いやすい形式で返す
- メールの下書きとして使える内容を含める`

export async function generateSummary(
  sessionId: string,
  transcriptText: string,
  insight: Insight | null
): Promise<SessionSummary> {
  const prompt = `
## セッションID
${sessionId}

## 会議の文字起こし
${transcriptText}

${insight ? `
## 既存のインサイト
${JSON.stringify(insight, null, 2)}
` : ""}

上記の情報から、会議終了後のサマリーを生成してください。
`

  const result = await chatCompletion([
    {
      role: "system",
      content: SUMMARY_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: prompt,
    },
  ])

  return JSON.parse(result.content || "{}")
}

// ローリングサマリー生成（会議中に2分ごとに更新）
const ROLLING_SUMMARY_PROMPT = `あなたは日本語の営業会議支援アシスタントです。
現在進行中の会議の要約を生成してください。

## 入力
- 直近の会話内容
- 前回のローリングサマリー

## 出力形式
{
  "summary_text": "現在までの会議要約（1-2文）",
  "key_topics": ["話題1", "話題2"],
  "identified_pain_points": ["特定された課題1", "特定された課題2"],
  "identified_constraints": ["特定された制約1"],
  "next_questions": ["次に聞くべき質問1", "次に聞くべき質問2"],
  "suggested_proposals": [
    {
      "title": "提案名",
      "reason": "なぜ今この提案が自然か"
    }
  ]
}

## 注意事項
- 簡潔にまとめる
- 重要な情報を見逃さない
- 次のアクションにつながる内容にする`

export async function generateRollingSummary(
  recentTranscript: string,
  previousSummary: string | null
): Promise<{
  summary_text: string
  key_topics: string[]
  identified_pain_points: string[]
  identified_constraints: string[]
  next_questions: string[]
  suggested_proposals: Array<{ title: string; reason: string }>
}> {
  const prompt = `
## 直近の会話内容
${recentTranscript}

${previousSummary ? `
## 前回のローリングサマリー
${previousSummary}
` : ""}

上記の情報から、現在の会議状況のローリングサマリーを生成してください。
`

  const result = await chatCompletion([
    {
      role: "system",
      content: ROLLING_SUMMARY_PROMPT,
    },
    {
      role: "user",
      content: prompt,
    },
  ])

  return JSON.parse(result.content || "{}")
}

// 次のアクション抽出
export async function extractNextActions(
  transcriptText: string,
  insight: Insight
): Promise<NextAction[]> {
  const prompt = `
## 会議の文字起こし
${transcriptText}

## 現在のインサイト
${JSON.stringify(insight, null, 2)}

上記の情報から、次のアクションアイテムを最大3つ抽出してください。
各アクションは具体的で、担当者と期限が明確になるようにしてください。

JSON形式で返してください：
[
  {
    "action": "アクション内容",
    "owner": "担当者（不明な場合はnull）",
    "deadline": "期限（不明な場合はnull）",
    "priority": "high | medium | low"
  }
]
`

  const result = await chatCompletion([
    {
      role: "system",
      content: "あなたは日本語の営業会議支援アシスタントです。次のアクションを抽出します。",
    },
    {
      role: "user",
      content: prompt,
    },
  ])

  return JSON.parse(result.content || "[]")
}

// メール下書き生成
export async function generateEmailDraft(
  summary: SessionSummary,
  clientName: string
): Promise<string> {
  const prompt = `
## 会議サマリー
${JSON.stringify(summary, null, 2)}

## 顧客名
${clientName}

上記の情報から、会議後のフォローアップメールの下書きを生成してください。
日本語で、ビジネスライクなトーンで書いてください。
`

  const result = await chatCompletion([
    {
      role: "system",
      content: "あなたは日本語のビジネスメール作成アシスタントです。",
    },
    {
      role: "user",
      content: prompt,
    },
  ])

  return result.content || ""
}
