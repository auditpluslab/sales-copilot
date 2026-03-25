import { NextRequest, NextResponse } from "next/server"
import { validateCsrfToken } from "./csrf"
import { cookies } from "next/headers"

/**
 * CSRF検証ミドルウェア
 * POST/PUT/DELETE/PATCHリクエストでCSRFトークンを検証
 */
export async function validateCsrfMiddleware(request: NextRequest) {
  const method = request.method

  // GET/HEAD/OPTIONSはCSRF検証不要
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null
  }

  // CSRFトークンを取得
  const csrfToken = request.headers.get('x-csrf-token')

  if (!csrfToken) {
    return NextResponse.json(
      { error: 'CSRF token missing' },
      { status: 403 }
    )
  }

  // CSRFトークンを検証
  const isValid = await validateCsrfToken(csrfToken)

  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    )
  }

  return null
}
