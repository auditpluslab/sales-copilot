/**
 * セキュリティユーティリティ
 *
 * XSS対策、サニタイズ、入力検証など
 */

/**
 * HTML文字をエスケープ（XSS対策）
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * ユーザー入力のサニタイズ
 */
export function sanitizeInput(input: string, options?: {
  maxLength?: number
  allowHtml?: boolean
}): string {
  const { maxLength = 10000, allowHtml = false } = options || {}

  // 長さ制限
  let sanitized = input.slice(0, maxLength)

  // HTMLを許可しない場合はタグを削除
  if (!allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '')
  }

  // 危険なパターンを検出
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onload=/i,
    /eval\(/i,
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      throw new Error('Dangerous input detected')
    }
  }

  return sanitized.trim()
}

/**
 * SQLインジェクション対策のパターンチェック
 */
export function isSafeSqlInput(input: string): boolean {
  // 危険なSQLパターン
  const sqlPatterns = [
    /(--)|(;)|(\bDROP\b)/i,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bEXEC\b)|(\bEXECUTE\b)/i,
    /(');|(\");)/i,
  ]

  return !sqlPatterns.some(pattern => pattern.test(input))
}

/**
 * UUIDのバリデーション
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * パスワード強度のチェック
 */
export function checkPasswordStrength(password: string): {
  isStrong: boolean
  issues: string[]
} {
  const issues: string[] = []

  if (password.length < 8) {
    issues.push('パスワードは8文字以上必要です')
  }

  if (!/[a-z]/.test(password)) {
    issues.push('小文字を含めてください')
  }

  if (!/[A-Z]/.test(password)) {
    issues.push('大文字を含めてください')
  }

  if (!/\d/.test(password)) {
    issues.push('数字を含めてください')
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    issues.push('特殊文字を含めてください')
  }

  return {
    isStrong: issues.length === 0,
    issues,
  }
}

/**
 * セキュアなランダム文字列の生成
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * タイミング攻撃対策の文字列比較
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
