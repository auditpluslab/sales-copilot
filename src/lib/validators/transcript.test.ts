import { describe, it, expect } from 'vitest'
import { TranscriptSegmentSchema, TranscriptQuerySchema } from './transcript'

describe('Transcript Validators', () => {
  describe('TranscriptSegmentSchema', () => {
    it('有効なデータを受け入れる', () => {
      const result = TranscriptSegmentSchema.safeParse({
        id: 'seg-123',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        ts_start: 0,
        ts_end: 1000,
        text: 'こんにちは',
        is_final: true,
      })
      expect(result.success).toBe(true)
    })

    it('textが10000文字超過でエラー', () => {
      const result = TranscriptSegmentSchema.safeParse({
        id: 'seg-123',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        ts_start: 0,
        ts_end: 1000,
        text: 'a'.repeat(10001),
        is_final: true,
      })
      expect(result.success).toBe(false)
    })

    it('無効なsession_idでエラー', () => {
      const result = TranscriptSegmentSchema.safeParse({
        id: 'seg-123',
        session_id: 'invalid',
        ts_start: 0,
        ts_end: 1000,
        text: 'test',
        is_final: true,
      })
      expect(result.success).toBe(false)
    })

    it('負のts_startでエラー', () => {
      const result = TranscriptSegmentSchema.safeParse({
        id: 'seg-123',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        ts_start: -1,
        ts_end: 1000,
        text: 'test',
        is_final: true,
      })
      expect(result.success).toBe(false)
    })

    it('confidenceが0-1の範囲外でエラー', () => {
      const result = TranscriptSegmentSchema.safeParse({
        id: 'seg-123',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        ts_start: 0,
        ts_end: 1000,
        text: 'test',
        is_final: true,
        confidence: 1.5,
      })
      expect(result.success).toBe(false)
    })

    it('XSS攻撃パターンを含むテキストを許可（サニタイズは別途実装）', () => {
      const result = TranscriptSegmentSchema.safeParse({
        id: 'seg-123',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        ts_start: 0,
        ts_end: 1000,
        text: '<script>alert("xss")</script>',
        is_final: true,
      })
      // バリデーションは通るが、表示時にサニタイズが必要
      expect(result.success).toBe(true)
    })

    it('IDが100文字超過でエラー', () => {
      const result = TranscriptSegmentSchema.safeParse({
        id: 'a'.repeat(101),
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        ts_start: 0,
        ts_end: 1000,
        text: 'test',
        is_final: true,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('TranscriptQuerySchema', () => {
    it('デフォルト値を設定', () => {
      const result = TranscriptQuerySchema.safeParse({
        session_id: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(100)
        expect(result.data.offset).toBe(0)
      }
    })

    it('limitの上限を強制', () => {
      const result = TranscriptQuerySchema.safeParse({
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        limit: 1000,
      })
      expect(result.success).toBe(false)
    })

    it('負のoffsetでエラー', () => {
      const result = TranscriptQuerySchema.safeParse({
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        offset: -1,
      })
      expect(result.success).toBe(false)
    })

    it('文字列の数値を変換', () => {
      const result = TranscriptQuerySchema.safeParse({
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        limit: '50',
        offset: '10',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(10)
      }
    })

    it('無効なsession_id形式でエラー', () => {
      const result = TranscriptQuerySchema.safeParse({
        session_id: 'not-a-uuid',
        limit: 10,
      })
      expect(result.success).toBe(false)
    })
  })
})
