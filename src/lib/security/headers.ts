import { NextResponse } from 'next/server'

/**
 * セキュリティヘッダーを設定するヘルパー関数
 */
export function setSecurityHeaders(response: NextResponse): NextResponse {
  // 既存のヘッダーにセキュリティヘッダーを追加
  response.headers.set('X-DNS-Prefetch-Control', 'false')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // CSP (Content Security Policy) - 開発環境では緩い設定
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.openai.com https://api.deepgram.com; frame-ancestors 'self';"
    )
  } else {
    // 開発環境ではNext.jsの開発サーバーを許可
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-eval' 'unsafe-inline'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https://api.openai.com https://api.deepgram.com; frame-ancestors 'self';"
    )
  }

  // HSTS (HTTP Strict Transport Security) - 本番環境のみ
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), interest-cohort=()'
  )

  return response
}

/**
 * APIレスポンスにセキュリティヘッダーを適用する
 */
export function createSecureResponse(data: any, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status })
  return setSecurityHeaders(response)
}
