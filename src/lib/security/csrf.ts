import { cookies } from 'next/headers'

const CSRF_SECRET = process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production'
const CSRF_TOKEN_LENGTH = 32

/**
 * CSRFトークンを生成
 */
export async function generateCsrfToken(): Promise<string> {
  const timestamp = Date.now()
  const random = generateRandomString(CSRF_TOKEN_LENGTH)
  const signature = await hmacSha256(`${timestamp}.${random}`, CSRF_SECRET)

  return `${timestamp}.${random}.${signature}`
}

/**
 * CSRFトークンを検証
 */
export async function validateCsrfToken(token: string | null): Promise<boolean> {
  if (!token) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [timestampStr, random, signature] = parts

  // タイムスタンプの検証（30分以内）
  const timestamp = parseInt(timestampStr, 10)
  const now = Date.now()
  const maxAge = 30 * 60 * 1000 // 30分

  if (isNaN(timestamp) || now - timestamp > maxAge) {
    return false
  }

  // 署名の検証
  const expectedSignature = await hmacSha256(`${timestampStr}.${random}`, CSRF_SECRET)

  return signature === expectedSignature
}

/**
 * CSRFトークンをクッキーに設定
 */
export async function setCsrfCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set('csrf_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60, // 30分
    path: '/'
  })
}

/**
 * ランダムな文字列を生成
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * HMAC-SHA256でハッシュを生成
 */
async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  )

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
