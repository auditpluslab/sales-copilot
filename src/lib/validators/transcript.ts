import { z } from 'zod'

// トランスクリプトセグメントのバリデーションスキーマ
export const TranscriptSegmentSchema = z.object({
  id: z.string().max(100, "IDが長すぎます"),
  session_id: z.string().uuid("有効なセッションIDが必要です"),
  ts_start: z.number().nonnegative("開始時刻は0以上である必要があります"),
  ts_end: z.number().nonnegative().nullable(),
  text: z.string().max(10000, "テキストが長すぎます（最大10000文字）"),
  is_final: z.boolean(),
  speaker: z.string().max(100).optional(),
  confidence: z.number().min(0).max(1).optional(),
})

// クエリパラメータのバリデーションスキーマ
export const TranscriptQuerySchema = z.object({
  session_id: z.string().uuid("有効なセッションIDが必要です"),
  limit: z.coerce.number().int().min(1).max(500, "最大500件まで").default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

// タイプエクスポート
export type TranscriptSegmentInput = z.infer<typeof TranscriptSegmentSchema>
export type TranscriptQueryInput = z.infer<typeof TranscriptQuerySchema>
