// SupabaseのJWTトークンを検証する関数

/**
 * JWTトークンを検証
 * @param token JWTトークン
 * @param jwtSecret SupabaseのJWTシークレット
 * @returns デコードされたペイロード、またはnull
 */
export async function verifySupabaseJWT(token: string, jwtSecret: string): Promise<any | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [headerB64, payloadB64, signatureB64] = parts

    // ペイロードをデコード
    const payload = JSON.parse(atob(payloadB64))

    // 署名を検証
    const expectedSignature = await hmacSha256(`${headerB64}.${payloadB64}`, jwtSecret)
    if (signatureB64 !== expectedSignature) {
      return null
    }

    // 有効期限を確認
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
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
