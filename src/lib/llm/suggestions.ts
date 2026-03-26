import { chatCompletion } from "./client"
import type { Insight, DeepDiveQuestion, SuggestionCard, ProposalTemplate } from "@/types"

const SUGGESTION_SYSTEM_PROMPT = `あなたは経験豊富な営業コンサルタントです。クライアントとの会話を深く分析し、**その場の文脈でしか生まれない質問と提案**を生成してください。

## 最も重要な原則
**テンプレート化された提案は禁止です。** クライアントの具体的な発言、数字、状況に基づいた提案をしてください。

## 質問を生成する際の指針
- クライアントが言った**具体的な言葉**を引用する
- 数字や具体名があれば必ず含める
- その会話でしか聞けない質問にする
- 短く、会議中に自然に聞ける形に

### 悪い質問の例（抽象的・テンプレート）
- "予算はどのくらいですか？"（誰にでも聞ける）
- "制約はありますか？"（会話の文脈無視）
- "競合と比較してどうですか？"（具体性なし）

### 良い質問の例（具体的・文脈に基づく）
- "先ほど「年間300万円」とおっしゃいましたが、そのうち初期投資として使えるのはどのくらいありますか？"
- "Excelで管理しているとのことですが、現在何件くらいの案件を管理されていますか？"
- "見積もり作成に40時間かかっているとのこと、その内訳で最も時間がかかっているのはどこですか？"

## 提案を生成する際の指針
- **クライアントの言葉をそのまま引用する**
- **数字や具体名を必ず含める**
- **小さく始める提案**（最初から大きな導入ではなく）
- **「まずは〇〇から始めませんか？」形式**
- **その会話でしか生まれない提案**にする

### 悪い提案の例（テンプレート・抽象的）
- "現状診断を提案します"（何を診断するか不明）
- "PoCを実施しましょう"（何を検証するか不明）
- "データ統合アセスメントをご提案します"（テンプレート感満載）
- "AI活用の可能性を探りましょう"（具体性なし）

### 良い提案の例（具体的・文脈に基づく）
- "先ほど「見積もり作成に40時間/月」とのお話でした。まずは見積もり作成のテンプレート化だけでも始めませんか？ 月20件とのこと、それだけで半分以下の時間になるはずです"
- "Excelで進捗が見えないとのこと、まずは売上案件だけでもGoogleスプレッドシートに移して、リアルタイムで進捗が見えるようにしませんか？ 1週間でできます"
- "「年間300万円の予算」とのこと、まずは既存の見積もりプロセスの可視化から始めませんか？ ボトルネックが見えてくれば、効果的に投資できます"

## 出力形式
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
}

## 注意事項
- 質問は最大3つ、提案は最大2つ
- **必ずクライアントの言葉を引用する**
- **必ず数字や具体名を含める**
- **テンプレート化された表現を避ける**
- 信頼度が低い提案は控えめにする`

export async function generateSuggestions(
  insight: Insight,
  transcriptText: string
): Promise<{
  questions: DeepDiveQuestion[]
  proposals: SuggestionCard[]
}> {
  const prompt = `
## 現在のインサイト
${JSON.stringify(insight, null, 2)}

## 直近の会話内容
${transcriptText}

上記の情報から、次に聞くべき質問と提案を生成してください。
`

  const result = await chatCompletion([
    {
      role: "system",
      content: SUGGESTION_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: prompt,
    },
  ])

  // LLMの出力からMarkdownコードブロックを取り除く
  let content = result.content || "{}"
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  return JSON.parse(content)
}

// 提案テンプレートマッチング
export function matchProposalTemplates(
  painPoints: string[],
  constraints: string[]
): ProposalTemplate[] {
  const templates: ProposalTemplate[] = [
    {
      id: "assessment",
      name: "現状診断",
      description: "現状の課題と改善領域を可視化する診断プログラム",
      use_when: ["現状が不明確", "課題が複数ある", "優先順位を決めたい"],
      target_pains: ["可視化不足", "課題が散在", "優先順位不明"],
      expected_value: "課題の全体像を把握し、優先順位を明確化",
      next_step_phrase: "まずは現状を整理することから始めませんか？",
      is_active: true,
    },
    {
      id: "poc",
      name: "PoC",
      description: "小規模な実証実験で効果を検証",
      use_when: ["効果を試したい", "小規模で始めたい", "リスクを抑えたい"],
      target_pains: ["導入リスク", "効果不確実", "予算制約"],
      expected_value: "低リスクで効果を検証し、本格導入の判断材料を提供",
      next_step_phrase: "まずは小規模なPoCで効果を確認してみませんか？",
      is_active: true,
    },
    {
      id: "ai-usecase",
      name: "AIユースケース選定",
      description: "AI活用の最適な領域と効果を特定",
      use_when: ["AIを活用したい", "AIの活用方法が不明確", "データ活用を進めたい"],
      target_pains: ["AI活用の方向性不明", "データ活用が進んでいない", "競合に遅れている"],
      expected_value: "AI活用の優先領域と期待効果を明確化",
      next_step_phrase: "AI活用の可能性を一緒に探ってみませんか？",
      is_active: true,
    },
    {
      id: "data-integration",
      name: "データ統合アセスメント",
      description: "データの散在状況を可視化し、統合ロードマップを策定",
      use_when: ["データが散在している", "データ連携が必要", "データ品質に課題"],
      target_pains: ["データ散在", "データ連携不足", "データ品質問題"],
      expected_value: "データ統合の優先順位と実現可能性を明確化",
      next_step_phrase: "データ資産の現状を把握してみませんか？",
      is_active: true,
    },
    {
      id: "bpr",
      name: "業務可視化/BPR",
      description: "業務プロセスの可視化と改善機会の特定",
      use_when: ["プロセスが不明確", "業務効率を上げたい", "属人化を解消したい"],
      target_pains: ["プロセス不透明", "業務効率低下", "属人化"],
      expected_value: "ボトルネックを特定し、改善効果を試算",
      next_step_phrase: "業務の見える化から始めてみませんか？",
      is_active: true,
    },
    {
      id: "pmo",
      name: "PMO支援",
      description: "プロジェクト管理体制の強化と進捗の可視化",
      use_when: ["プロジェクトが進まない", "部門間調整が必要", "進捗管理が必要"],
      target_pains: ["プロジェクト停滞", "部門間調整不足", "進捗管理不十分"],
      expected_value: "プロジェクトの透明性向上と早期課題発見",
      next_step_phrase: "プロジェクト管理体制を見直してみませんか？",
      is_active: true,
    },
    {
      id: "kpi",
      name: "KPI設計/可視化",
      description: "成果測定のためのKPI設計とダッシュボード構築",
      use_when: ["KPIが不明確", "成果測定が必要", "指標を整備したい"],
      target_pains: ["KPI不明確", "成果測定困難", "指標不足"],
      expected_value: "成果の可視化とデータドリブンな意思決定の実現",
      next_step_phrase: "成果を測定する仕組みから整えてみませんか？",
      is_active: true,
    },
  ]

  // マッチングロジック
  const matchedTemplates: ProposalTemplate[] = []

  for (const template of templates) {
    const painMatch = template.target_pains.some(pain =>
      painPoints.some(pp => pp.includes(pain) || pp.includes(pain))
    )

    const constraintMatch = template.use_when.some(when =>
      constraints.some(c => c.includes(when) || when.includes(c))
    )

    if (painMatch || constraintMatch) {
      matchedTemplates.push(template)
    }
  }

  return matchedTemplates.slice(0, 2)
}
