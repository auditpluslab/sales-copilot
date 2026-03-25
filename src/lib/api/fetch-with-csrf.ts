/**
 * CSRFトークンを自動的に含めるfetchラッパー
 */

let csrfToken: string | null = null

/**
 * CSRFトークンを取得してキャッシュする
 */
export async function initCsrfToken() {
  try {
    const response = await fetch('/api/auth/csrf')
    if (response.ok) {
      const data = await response.json()
      csrfToken = data.csrf_token
    }
  } catch (error) {
    console.error('Failed to initialize CSRF token:', error)
  }
}

/**
 * CSRFトークン付きでfetchを実行
 */
export async function fetchWithCsrf(url: string, options: RequestInit = {}) {
  // CSRFトークンがない場合は初期化
  if (!csrfToken) {
    await initCsrfToken()
  }

  // CSRFトークンをヘッダーに追加
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

/**
 * CSRFトークンをクリア（ログアウト時など）
 */
export function clearCsrfToken() {
  csrfToken = null
}
