import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * セキュリティミドルウェア
 *
 * - CORS設定
 * - セキュリティヘッダーの追加
 * - レート制限（簡易版）
 */

// 許可するオリジン
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001']

// レート制限（メモリベース、本番ではRedis等を使用）
const rateLimit = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1分
  maxRequests: 100, // 1分間の最大リクエスト数
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // 1. CORS設定
  const origin = request.headers.get('origin')

  // 開発環境ではすべてのオリジンを許可、本番では許可リストをチェック
  if (process.env.NODE_ENV === 'development') {
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400') // 24時間

  // OPTIONSリクエストの処理
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    })
  }

  // 2. セキュリティヘッダーの追加
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()')

  // 本番環境ではStrict-Transport-Securityを有効化
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // 3. APIエンドポイントのレート制限
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()

    // 古いエントリをクリーンアップ
    for (const [key, value] of rateLimit.entries()) {
      if (now > value.resetTime) {
        rateLimit.delete(key)
      }
    }

    // リクエストカウント
    const limit = rateLimit.get(ip)
    if (limit) {
      if (now > limit.resetTime) {
        // ウィンドウがリセットされた
        rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs })
      } else if (limit.count >= RATE_LIMIT.maxRequests) {
        // レート制限超過
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: response.headers }
        )
      } else {
        limit.count++
      }
    } else {
      rateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT.windowMs })
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
