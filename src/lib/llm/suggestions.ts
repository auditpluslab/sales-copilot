import { chatCompletion } from "./client"
import type { Insight, DeepDiveQuestion, SuggestionCard, ProposalTemplate } from "@/types"

const SUGGESTION_SYSTEM_PROMPT = `あなたは日本語の営業会議支援アシスタントです。
会議の内容から、営業担当者が次に聞くべき質問と提案を生成してください。

## 質問の種類
1. 制約確認: 予算、期間、リソースの制約を確認する質問
2. 価値確認: 課題による影響や価値を確認する質問
3. 意思決定: 決裁プロセスや意思決定者を確認する質問
4. 競合比較: 既存ソリューションや競合との比較に関する質問
5. タイムライン: 期限やスケジュールに関する質問

## 提案の種類
1. 現状診断
2. 構想策定
3. PoC
4. 業務可視化/BPR
5. データ統合アセスメント
6. AIユースケース選定
7. PMO支援
8. KPI設計/可視化

## 出力形式
{
  "questions": [
    {
      "question": "質問文（短く、読み上げ可能な長さ）,
      "intent": "なぜこの質問を聞くのか",
      "category": "constraint | value | timeline | budget | decision | competition",
      "priority": 1〜3,
      "evidence": "この質問の根拠となる発話"
    }
  ],
  "proposals": [
    {
      "title": "提案名",
      "body": "提案の詳細説明",
      "reason": "なぜ今この提案が自然か",
      "expected_value": "期待される効果",
      "next_step_phrase": "次の一言",
      "evidence": "根拠となる発話",
      "confidence": "high | medium | low",
      "rank": 1〜2
    }
  ]
}

## 注意事項
- 質問は最大3つまで
- 提案は最大2つまで
- 質問は短く、会議中に読み上げ可能な長さに
- 必ず根拠（発話）を含める
- 信頼度が低い提案は控えめに表示`

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
