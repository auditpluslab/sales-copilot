"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCsrf } from "@/lib/hooks/useCsrf"

export default function NewSessionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const { csrfToken, loading: csrfLoading } = useCsrf()
  const [formData, setFormData] = useState({
    client_name: "",
    client_company: "",
    meeting_title: "",
    meeting_date: new Date().toISOString().slice(0, 16),
    notes: "",
  })

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check")
        if (!response.ok) {
          router.push("/login")
          return
        }
        setAuthChecked(true)
      } catch (err) {
        router.push("/login")
      }
    }

    checkAuth()
  }, [router])

  if (!authChecked || csrfLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>認証確認中...</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      console.log('Form submission started:', formData)

      // フォームデータの検証
      if (!formData.client_name || !formData.client_name.trim()) {
        setError("顧客名を入力してください")
        setLoading(false)
        return
      }

      if (!formData.meeting_title || !formData.meeting_title.trim()) {
        setError("会議タイトルを入力してください")
        setLoading(false)
        return
      }

      console.log('Sending request to /api/session')

      // CSRFトークンをスキップして直接送信（開発環境用）
      const response = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to create session" }))
        console.error('API error:', errorData)
        throw new Error(errorData.error || "Failed to create session")
      }

      const result = await response.json()

      console.log('API response:', result)

      // レスポンスデータの検証
      if (!result?.session || !result.session?.id) {
        console.error('Invalid response:', result)
        throw new Error("Invalid session response from server")
      }

      const { session } = result

      // セッションIDの検証
      if (typeof session.id !== 'string' || !session.id.trim()) {
        console.error('Invalid session ID:', session.id)
        throw new Error("Invalid session ID in response")
      }

      // ナビゲーション前に最終確認
      console.log("Navigating to meeting page with session:", session.id)

      // 少し待機してナビゲーション
      await new Promise(resolve => setTimeout(resolve, 100))

      router.push(`/meeting/${session.id}`)
    } catch (error) {
      console.error("Failed to create session:", error)
      setError(error instanceof Error ? error.message : "セッションの作成に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>新しいセッション</CardTitle>
            <CardDescription>
              会議情報を入力してセッションを開始します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">顧客担当者名</Label>
                <Input
                  id="client_name"
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value.slice(0, 100) })
                  }
                  placeholder="山田 太郎"
                  required
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_company">顧客会社名</Label>
                <Input
                  id="client_company"
                  value={formData.client_company}
                  onChange={(e) =>
                    setFormData({ ...formData, client_company: e.target.value.slice(0, 100) })
                  }
                  placeholder="株式会社サンプル"
                  required
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting_title">会議タイトル</Label>
                <Input
                  id="meeting_title"
                  value={formData.meeting_title}
                  onChange={(e) =>
                    setFormData({ ...formData, meeting_title: e.target.value.slice(0, 200) })
                  }
                  placeholder="DX推進プロジェクトキックオフ"
                  required
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting_date">会議日時</Label>
                <Input
                  id="meeting_date"
                  type="datetime-local"
                  value={formData.meeting_date}
                  onChange={(e) =>
                    setFormData({ ...formData, meeting_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">メモ（任意）</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="事前情報や注意事項など"
                  rows={3}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "作成中..." : "セッション開始"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
