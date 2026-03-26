import { chatCompletion } from "./client"
import type { Insight, DeepDiveQuestion, SuggestionCard } from "@/types"

export async function generateSuggestions(
  insight: Insight,
  transcriptText: string
): Promise<{
  questions: DeepDiveQuestion[]
  proposals: SuggestionCard[]
}> {
  // システムプロンプト：思考方法だけを指定（短く）
  const SYSTEM_PROMPT = `あなたは最高の営業コンサルタントです。クライアントとの会話から、**その場でしか生まれない質問と提案**を生成してください。

## 最も重要な原則
**テンプレート化された提案は絶対に禁止です。**

## 禁止ワード（絶対に使わないでください）
- 「テンプレート」「ダッシュボード」「可視化」「ワークショップ」
- 「PoC」「システム導入」「ソリューション」「DX推進」「デジタル変革」
- 「最適化」「効率化」「自動化」「プラットフォーム」

## 提案の作り方
1. **クライアントの言葉をそのまま引用する**
2. **具体的な数字、ツール名、アクションを含める**
3. **「まずは〇〇から始めませんか？」形式（小さく始める）**
4. **「10分で導入できる」「既存ツールを活用する」を必須**
5. **「〇時間短縮」「〇%向上」など具体的な効果を示す**

## 良い提案の例
「先ほどの『月20件で40時間』というお話でしたが、まずはよく使う3つの商品をExcelの下拉りリストにして、選ぶだけで入力されるようにしませんか？
これだけで1件あたり30分短縮でき、月20件で10時間節約できます。最初の1週間で試してみませんか？」

## 悪い提案の例
「テンプレート化による効率化」「ダッシュボード導入」「PoCの実施」
→ 抽象的すぎて、具体的なアクションが不明

## 出力形式
最後にJSON形式で出力してください。質問は最大3つ、提案は最大2つ。`

  // ユーザープロンプト：会話データと具体的な指示
  const userPrompt = `以下の会話から、質問と提案を生成してください。

## 手順
1. 会話の中から、具体的な数字、ツール名、人物、シーンをすべて抽出してください
2. 抽出した情報に基づいて、課題を定義してください（誰が、いつ、どんな状況で、何に困っているのか）
3. 課題に対して、10分で導入でき、既存ツールを活用し、具体的な数字で効果が示せる解決策を考えてください
4. 以下のJSON形式で出力してください

## 会話内容
${transcriptText}

## インサイト
${JSON.stringify(insight, null, 2)}

---

## JSON出力形式
{
  "questions": [
    {
      "question": "質問文（クライアントの言葉を引用し、数字や具体名を含める）",
      "intent": "なぜこの質問を聞くのか",
      "category": "constraint | value | timeline | budget | decision | competition",
      "priority": 1〜3,
      "evidence": "この質問の根拠となる具体的な発話をそのまま引用"
    }
  ],
  "proposals": [
    {
      "title": "具体的な提案タイトル（クライアントの言葉を含める）",
      "body": "提案の詳細説明（数字、具体名、クライアントの言葉を必ず含める）",
      "reason": "なぜ今この提案が自然か（クライアントの発言を引用して説明）",
      "expected_value": "期待される効果（数字で示す）",
      "next_step_phrase": "次の一言（「まずは〇〇から始めませんか？」形式）",
      "evidence": "根拠となる発話をそのまま引用",
      "confidence": "high | medium | low",
      "rank": 1〜2
    }
  ]
}`;

  const result = await chatCompletion([
    {
      role: "system",
      content: SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ])

  // LLMの出力からMarkdownコードブロックを取り除く
  let content = result.content || "{}"
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  return JSON.parse(content)
}
