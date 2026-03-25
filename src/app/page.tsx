"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useCsrf } from "@/lib/hooks/useCsrf"
import type { Session } from "@/types"

export default function HomePage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const { csrfToken } = useCsrf()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check")
        if (!response.ok) {
          router.push("/login")
          return
        }

        const fetchSessions = async () => {
          try {
            const response = await fetch("/api/session")
            if (response.ok) {
              const data = await response.json()
              setSessions(data.sessions || [])
            } else {
              setError("セッションの取得に失敗しました")
            }
          } catch (err) {
            setError("セッションの取得に失敗しました")
            console.error(err)
          } finally {
            setLoading(false)
          }
        }

        setAuthChecked(true)
        fetchSessions()
      } catch (err) {
        router.push("/login")
      }
    }

    checkAuth()
  }, [router])

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">進行中</Badge>
      case "completed":
        return <Badge variant="secondary">完了</Badge>
      case "scheduled":
        return <Badge variant="outline">予定</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">営業会議コパイロット</h1>
            <p className="text-gray-600 mt-1">リアルタイムで会議を支援</p>
          </div>
          <div className="flex gap-2">
            <Link href="/session/new">
              <Button>新しいセッション</Button>
            </Link>
            <Button
              variant="outline"
              onClick={async () => {
                await fetch("/api/auth/logout", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(csrfToken && { "X-CSRF-Token": csrfToken }),
                  },
                })
                router.push("/login")
              }}
            >
              ログアウト
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <h2 className="text-xl font-semibold text-gray-800">最近のセッション</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-8 text-center text-red-500">
                {error}
              </CardContent>
            </Card>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                セッションがありません。新しいセッションを開始してください。
              </CardContent>
            </Card>
          ) : (
            sessions.map((session) => (
              <Link key={session.id} href={`/meeting/${session.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{session.title}</CardTitle>
                      {getStatusBadge(session.status || "scheduled")}
                    </div>
                    <CardDescription>{session.client_name || "クライアント未設定"}</CardDescription>
                    {session.started_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(session.started_at).toLocaleString("ja-JP")}
                      </p>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">リアルタイム文字起こし</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              ブラウザ内Whisperによる高精度な日本語STTで会議をリアルタイムに記録
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">インサイト抽出</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              課題・制約・ステークホルダーを自動で抽出・整理
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">提案サポート</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              次に聞くべき質問と提案カードをリアルタイムで生成
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
