import { chatCompletion } from "./client"
import type { Insight, PainPoint, Constraint, Stakeholder, Timeline, Sentiment } from "@/types"

const INSIGHT_SYSTEM_PROMPT = `あなたは日本語の営業会議のアシスタントです。
会議の文字起こしから以下の情報を抽出し、JSONで返してください：

## 抽出対象
1. 課題（Pain Points）: 顧客が抱えている問題や課題
2. 影響（Impact）: 課題による影響度や範囲
3. 制約（Constraints）: 予算、期間、技術、組織などの制約
4. ステークホルダー（Stakeholders）: 関係者とその役割・態度
5. タイムライン（Timeline）: 緊急度と期限・マイルストーン
6. 予算示唆（Budget Hint）: 予算に関する情報
7. 競合（Competitors）: 既存ベンダーや競合他社
8. 顧客温度感（Sentiment）: positive, neutral, negative, mixed

## 出力形式
{
  "summary_text": "会議の要約（2〜3文）",
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
    "deadline": "期限（ISO形式）",
    "milestones": ["マイルストーンの配列"]
  },
  "sentiment": "positive | neutral | negative | mixed",
  "budget_hint": "予算に関する情報（ない場合はnull）",
  "competitors": ["競合や既存ベンダーの配列"]
}

## 注意事項
- 必須フィールドには根拠となる発話を含めてください
- 影響度が明確でない場合は "unknown" に設定してください
- 信頼度は confidence を追加してください
- 1会議あたり、必ず根拠を示してください`

export async function generateInsight(
  transcriptText: string,
  existingInsight: Insight | null
): Promise<Insight> {
  const prompt = `以下が今回の会議内容です。
${transcriptText}
${existingInsight ? `
## 既存のインサイト
${JSON.stringify(existingInsight, null, 2)}

この既存のインサイトを更新・拡張してください。
` : ""}`

  const result = await chatCompletion([
    {
      role: "system",
      content: INSIGHT_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: prompt,
    },
  ])

  // LLMの出力からMarkdownコードブロックを取り除く
  let content = result.content || "{}"
  // Markdownのコードブロックを削除（```json ... ```）
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '')
  // 余分な空白を削除
  content = content.trim()

  return JSON.parse(content) as Insight
}

export function extractPainPoints(text: string): PainPoint[] {
  // 簡易版として実装
  const lowerText = text.toLowerCase()
  const painKeywords = [
    "課題", "問題", "困っ", "悩み", "懸念", "ボトルネック",
    "遅い", "できない", "うまくいかない", "失敗", "リスク",
  ]

  const pains: PainPoint[] = []

  // キーワードを含む文脈を抽出
  for (const keyword of painKeywords) {
    const regex = new RegExp(`[^。]*${keyword}[^。]*[。]`, "g")
    const matches = text.match(regex)
    if (matches) {
      matches.forEach((match) => {
        pains.push({
          description: match.trim(),
          impact: "medium",
          evidence: match.trim(),
        })
      })
    }
  }

  return pains.slice(0, 3)
}
