// ============================================
// Session Types
// ============================================

export interface Session {
  id: string
  title: string
  client_name: string | null
  meeting_type: MeetingType | null
  started_at: string
  ended_at: string | null
  created_by: string
  consent_confirmed: boolean
  notes?: string
  status?: string
  meeting_title?: string
  created_at?: string
}

export type MeetingType =
  | "initial_hearing"
  | "proposal_deep_dive"
  | "poc_assessment"
  | "executive_meeting"
  | "follow_up"

// ============================================
// Transcript Types
// ============================================

export interface TranscriptSegment {
  id: string
  session_id: string
  ts_start: number
  ts_end: number | null
  text: string
  is_final: boolean
  speaker?: string
  confidence?: number
  source: "browser" | "system"
  created_at?: string
}

// ============================================
// Insight Types
// ============================================

export interface Insight {
  id: string
  session_id: string
  summary_text: string
  pain_points: PainPoint[]
  constraints: Constraint[]
  stakeholders: Stakeholder[]
  timeline: Timeline | null
  sentiment: Sentiment
  budget_hint: string | null
  competitors: string[]
  updated_at: string
}

export interface PainPoint {
  description: string
  impact: "high" | "medium" | "low"
  evidence: string
}

export interface Constraint {
  type: "budget" | "timeline" | "technical" | "organizational" | "resource"
  description: string
  evidence: string
}

export interface Stakeholder {
  name: string
  role: string
  attitude: "champion" | "neutral" | "skeptical" | "blocker" | "unknown"
  notes?: string
}

export interface Timeline {
  urgency: "high" | "medium" | "low"
  deadline?: string
  milestones?: string[]
}

export type Sentiment = "positive" | "neutral" | "negative" | "mixed"

// ============================================
// Suggestion Card Types
// ============================================

export interface SuggestionCard {
  id: string
  session_id: string
  type: "question" | "proposal"
  title: string
  body: string
  evidence_text: string
  confidence: "high" | "medium" | "low"
  rank: number
  created_at: string
  feedback?: FeedbackType
}

export type FeedbackType = "positive" | "negative" | null

// ============================================
// Deep Dive Question Types
// ============================================

export interface DeepDiveQuestion {
  id: string
  question: string
  intent: string
  category: "constraint" | "value" | "timeline" | "budget" | "decision" | "competition"
  priority: number
  evidence: string
}

// ============================================
// Proposal Template Types
// ============================================

export interface ProposalTemplate {
  id: string
  name: string
  description: string
  use_when: string[]
  target_pains: string[]
  expected_value: string
  next_step_phrase: string
  is_active: boolean
}

// ============================================
// Case Snippet Types
// ============================================

export interface CaseSnippet {
  id: string
  title: string
  industry: string
  pain_tags: string[]
  snippet_text: string
  embedding?: number[]
  similarity?: number
}

// ============================================
// Feedback Event Types
// ============================================

export interface FeedbackEvent {
  id: string
  session_id: string
  target_id: string
  target_type: "question" | "proposal"
  vote: "positive" | "negative"
  created_at: string
}

// ============================================
// API Types
// ============================================

export interface CreateSessionInput {
  title: string
  client_name?: string
  meeting_type?: MeetingType
  notes?: string
  consent_confirmed: boolean
}

export interface SessionSummary {
  session: Session
  summary: string
  pain_points: PainPoint[]
  confirmed_facts: string[]
  unconfirmed_items: string[]
  proposals: SuggestionCard[]
  next_actions: NextAction[]
  thank_you_email_draft?: string
}

export interface NextAction {
  action: string
  owner: string
  deadline?: string
  priority: "high" | "medium" | "low"
}

// ============================================
// Real-time Event Types
// ============================================

export type RealtimeEvent =
  | { type: "transcript"; data: TranscriptSegment }
  | { type: "insight"; data: Insight }
  | { type: "suggestion"; data: SuggestionCard }
  | { type: "session_end"; data: SessionSummary }

// ============================================
// STT Status Types
// ============================================

export type STTStatus = "idle" | "connecting" | "connected" | "error" | "disconnected"

export interface STTState {
  status: STTStatus
  error?: string
  reconnectAttempts: number
}

// ============================================
// UI State Types
// ============================================

export interface MeetingUIState {
  isRecording: boolean
  isPaused: boolean
  showPinnedOnly: boolean
  activeTab: "transcript" | "summary" | "questions" | "proposals"
}
