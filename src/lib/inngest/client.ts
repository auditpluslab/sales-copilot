import { Inngest } from "inngest"

// Types for events
interface PainPoint {
  description: string
  impact: "high" | "medium" | "low"
  evidence: string
}

interface Constraint {
  type: "budget" | "timeline" | "technical" | "organizational" | "resource"
  description: string
  evidence: string
}

interface Stakeholder {
  name: string
  role: string
  attitude: "champion" | "neutral" | "skeptical" | "blocker" | "unknown"
  notes?: string
}

interface Timeline {
  urgency: "high" | "medium" | "low"
  deadline?: string
  milestones?: string[]
}

type Sentiment = "positive" | "neutral" | "negative" | "mixed"

interface DeepDiveQuestion {
  question: string
  reason: string
  priority: "high" | "medium" | "low"
}

interface ProposalSuggestion {
  title: string
  description: string
  value_proposition: string
}

interface SuggestionCard {
  title: string
  description: string
  type: "solution" | "service" | "next_step"
}

interface NextAction {
  action: string
  owner?: string
  due_date?: string
}

// Inngest クライアント設定
export const inngest = new Inngest({
  id: "sales-copilot",
  name: "Sales Copilot",
  eventKey: process.env.INNGEST_EVENT_KEY!,
})

// イベント定義
export const Events = {
  // 文字起こしセグメントを受信時
  "transcript/received": {
    sessionId: "",
    segment: {
      id: "",
      ts_start: 0,
      ts_end: null as number | null,
      text: "",
      is_final: false,
      speaker: "" as string | undefined,
    },
  },

  // 分析トリガー（45〜90秒ごと）
  "analysis/triggered": {
    sessionId: "",
    triggerType: "" as "interval" | "topic_change" | "keyword_detected",
    triggerData: {
      detectedTopic: "" as string | undefined,
      detectedKeywords: [] as string[] | undefined,
    },
  },

  // セッション終了時
  "session/ended": {
    sessionId: "",
  },

  // 洞察生成完了
  "insight/generated": {
    sessionId: "",
    insight: {
      id: "",
      summary_text: "",
      pain_points: [] as PainPoint[],
      constraints: [] as Constraint[],
      stakeholders: [] as Stakeholder[],
      timeline: null as Timeline | null,
      sentiment: "" as Sentiment,
      budget_hint: null as string | null,
      competitors: [] as string[],
    },
  },

  // 提案カード生成
  "suggestion/generated": {
    sessionId: "",
    suggestions: {
      questions: [] as DeepDiveQuestion[],
      proposals: [] as ProposalSuggestion[],
    },
  },

  // 要約生成完了
  "summary/generated": {
    sessionId: "",
    summary: {
      summary: "",
      pain_points: [] as PainPoint[],
      confirmed_facts: [] as string[],
      unconfirmed_items: [] as string[],
      proposals: [] as SuggestionCard[],
      next_actions: [] as NextAction[],
      thank_you_email_draft: "" as string | undefined,
    },
  },
}
