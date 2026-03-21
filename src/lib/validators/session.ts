import { z } from 'zod'

// セッション作成のバリデーションスキーマ
export const CreateSessionSchema = z.object({
  client_name: z.string().min(1, "クライアント名は必須です").max(100),
  client_company: z.string().max(100).optional(),
  meeting_title: z.string().min(1, "会議タイトルは必須です").max(200),
  meeting_date: z.string().datetime().optional(),
  notes: z.string().max(10000).optional(),
})

// セッション更新のバリデーションスキーマ
export const UpdateSessionSchema = z.object({
  id: z.string().uuid("有効なセッションIDが必要です"),
  client_name: z.string().min(1).max(100).optional(),
  client_company: z.string().max(100).optional(),
  meeting_title: z.string().min(1).max(200).optional(),
  meeting_date: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).optional(),
  notes: z.string().max(10000).optional(),
})

// セッションIDパラメータのバリデーション
export const SessionIdSchema = z.string().uuid("有効なセッションIDが必要です")

// タイプエクスポート
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>
