/**
 * レート制限ユーティリティ
 *
 * APIエンドポイントの過剰なリクエストを防ぐ
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// メモリベースのレート制限ストア（本番ではRedis等を使用）
const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitConfig {
  windowMs: number // タイムウィンドウ（ミリ秒）
  maxRequests: number // ウィンドウ内の最大リクエスト数
  skipSuccessfulRequests?: boolean // 成功したリクエストをカウントしない
  skipFailedRequests?: boolean // 失敗したリクエストをカウントしない
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: Date
}

/**
 * レート制限をチェック
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // 古いエントリをクリーンアップ
  if (entry && now > entry.resetTime) {
    rateLimitStore.delete(identifier)
  }

  // 新規エントリまたはリセット後
  const current = rateLimitStore.get(identifier)
  if (!current || now > current.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    }
    rateLimitStore.set(identifier, newEntry)

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: new Date(newEntry.resetTime),
    }
  }

  // 制限チェック
  if (current.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      resetTime: new Date(current.resetTime),
    }
  }

  // カウント増加
  current.count++

  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - current.count,
    resetTime: new Date(current.resetTime),
  }
}

/**
 * レート制限エンドポイントごとの設定
 */
export const rateLimitConfigs = {
  // 認証エンドポイント: 厳しい制限
  '/api/auth': {
    windowMs: 15 * 60 * 1000, // 15分
    maxRequests: 5, // 15分間で5回
  },

  // セッション作成: 中程度の制限
  '/api/session': {
    windowMs: 60 * 60 * 1000, // 1時間
    maxRequests: 100, // 1時間で100回
  },

  // 一般的なAPI: 緩やかな制限
  '/api': {
    windowMs: 60 * 1000, // 1分
    maxRequests: 100, // 1分で100回
  },
}

/**
 * クライアントIPアドレスの取得
 */
export function getClientIp(request: Request): string {
  // ヘッダーからIPを取得（プロキシ対応）
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

/**
 * レート制限ストアのクリーンアップ（古いエントリを削除）
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now()

  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

// 定期的なクリーンアップ（1分ごと）
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 60 * 1000)
}
