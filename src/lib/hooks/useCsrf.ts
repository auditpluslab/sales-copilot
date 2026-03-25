import { useEffect, useState } from "react"

/**
 * CSRFトークンを管理するフック
 */
export function useCsrf() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initCsrf = async () => {
      try {
        const response = await fetch('/api/auth/csrf')
        if (response.ok) {
          const data = await response.json()
          setCsrfToken(data.csrf_token)
        }
      } catch (error) {
        console.error('Failed to initialize CSRF token:', error)
      } finally {
        setLoading(false)
      }
    }

    initCsrf()
  }, [])

  return { csrfToken, loading }
}
