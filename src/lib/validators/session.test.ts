import { describe, it, expect } from 'vitest'
import { CreateSessionSchema, UpdateSessionSchema, SessionIdSchema } from './session'

describe('Session Validators', () => {
  describe('CreateSessionSchema', () => {
    it('有効なデータを受け入れる', () => {
      const result = CreateSessionSchema.safeParse({
        client_name: '株式会社テスト',
        meeting_title: '初回ヒアリング',
      })
      expect(result.success).toBe(true)
    })

    it('クライアント名が空の場合エラー', () => {
      const result = CreateSessionSchema.safeParse({
        client_name: '',
        meeting_title: '会議',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('必須')
      }
    })

    it('会議タイトルが空の場合エラー', () => {
      const result = CreateSessionSchema.safeParse({
        client_name: 'テスト',
        meeting_title: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('必須')
      }
    })

    it('クライアント名が100文字超過でエラー', () => {
      const result = CreateSessionSchema.safeParse({
        client_name: 'a'.repeat(101),
        meeting_title: '会議',
      })
      expect(result.success).toBe(false)
    })

    it('メモが10000文字超過でエラー', () => {
      const result = CreateSessionSchema.safeParse({
        client_name: 'テスト',
        meeting_title: '会議',
        notes: 'a'.repeat(10001),
      })
      expect(result.success).toBe(false)
    })

    it('オプションフィールドを省略可能', () => {
      const result = CreateSessionSchema.safeParse({
        client_name: 'テスト',
        meeting_title: '会議',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('UpdateSessionSchema', () => {
    it('有効なUUIDを受け入れる', () => {
      const result = UpdateSessionSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
      })
      expect(result.success).toBe(true)
    })

    it('無効なUUIDでエラー', () => {
      const result = UpdateSessionSchema.safeParse({
        id: 'invalid-uuid',
        status: 'active',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('セッションID')
      }
    })

    it('無効なステータスでエラー', () => {
      const result = UpdateSessionSchema.safeParse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'invalid-status',
      })
      expect(result.success).toBe(false)
    })

    it('有効なステータス値を受け入れる', () => {
      const statuses = ['scheduled', 'active', 'completed', 'cancelled'] as const
      for (const status of statuses) {
        const result = UpdateSessionSchema.safeParse({
          id: '123e4567-e89b-12d3-a456-426614174000',
          status,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('SessionIdSchema', () => {
    it('有効なUUIDを受け入れる', () => {
      const result = SessionIdSchema.safeParse('123e4567-e89b-12d3-a456-426614174000')
      expect(result.success).toBe(true)
    })

    it('無効なUUIDでエラー', () => {
      const result = SessionIdSchema.safeParse('invalid-uuid')
      expect(result.success).toBe(false)
    })

    it('空文字でエラー', () => {
      const result = SessionIdSchema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('SQLインジェクションパターンを拒否', () => {
      const result = SessionIdSchema.safeParse("'; DROP TABLE sessions; --")
      expect(result.success).toBe(false)
    })
  })
})
