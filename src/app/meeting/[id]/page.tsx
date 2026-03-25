"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSTT, useTranscriptSegments } from "@/lib/stt/hooks"
import { getAccessToken } from "@/lib/auth"
import { LANGUAGE_OPTIONS } from "@/lib/stt/web-speech-client"
import type { Insight, SuggestionCard, DeepDiveQuestion, Session } from "@/types"

export default function MeetingPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [insight, setInsight] = useState<Insight | null>(null)
  const [suggestions, setSuggestions] = useState<{
    questions: DeepDiveQuestion[]
    proposals: SuggestionCard[]
  } | null>(null)
  const [sttError, setSttError] = useState<string | null>(null)
  const [updateCounter, setUpdateCounter] = useState(0)

  // insight/suggestionsの変更を監視（デバッグ用）
  useEffect(() => {
    if (insight) {
      console.log('[State Update] Insight updated:', {
        summary: insight.summary_text?.substring(0, 50),
        painPoints: insight.pain_points?.length || 0,
        constraints: insight.constraints?.length || 0,
        stakeholders: insight.stakeholders?.length || 0
      })
      // 強制的に再描画をトリガー
      setUpdateCounter(prev => prev + 1)
    }
  }, [insight])

  useEffect(() => {
    if (suggestions) {
      console.log('[State Update] Suggestions updated:', {
        questions: suggestions.questions?.length || 0,
        proposals: suggestions.proposals?.length || 0
      })
      // 強制的に再描画をトリガー
      setUpdateCounter(prev => prev + 1)
    }
  }, [suggestions])

  const {
    segments,
    addSegment,
    getFinalSegments,
    getInterimSegment,
  } = useTranscriptSegments()

  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const refreshInsightRef = useRef<(() => Promise<void>) | null>(null)
  const refreshSuggestionsRef = useRef<(() => Promise<void>) | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // 認証チェックとuserId取得
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check")
        if (!response.ok) {
          router.push("/login")
          return
        }

        // 開発環境ではモックuserIdを使用
        if (process.env.NODE_ENV !== "production") {
          setUserId("test-user-id")
          setAuthChecked(true)
          return
        }

        // userIdを取得
        const { createClient } = await import("@/lib/db/supabase")
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          setUserId(session.user.id)
        }

        setAuthChecked(true)
      } catch (err) {
        router.push("/login")
      }
    }

    checkAuth()
  }, [router])

  const {
    status: sttStatus,
    segments: sttSegments,
    connect,
    disconnect,
    errorMessage: sttErrorMessage,
    language: currentLanguage,
    setLanguage: setCurrentLanguage,
  } = useSTT({ sessionId, userId })

  // Web Speech APIではオーディオレコーダー不要
  // const { isRecording, startRecording, stopRecording, error: recorderError } = useAudioRecorder({
  //   onAudioData: (data) => {
  //     sendAudio(data)
  //   },
  // })

  // セッション情報を取得
  useEffect(() => {
    const fetchSession = async () => {
      if (!authChecked) return

      console.log('🔍 useEffect: Fetching session for sessionId:', sessionId)

      if (!sessionId) {
        console.error('No sessionId found')
        setIsLoading(false)
        return
      }

      try {
        // URLSearchParamsを使用して確実にクエリパラメータを付与
        const params = new URLSearchParams({ id: sessionId })
        const url = `/api/session?${params.toString()}`
        console.log('🔍 Fetching URL:', url)

        const response = await fetch(url, {
          cache: 'no-store', // ブラウザからリクエストを送信する
        })

        console.log('🔍 Response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('Session data:', data)

          // レスポンスデータの検証
          if (data?.session && typeof data.session === 'object') {
            setSession(data.session)
            setIsLoading(false)
          } else {
            console.error('Invalid session data format:', data)
            setIsLoading(false)
          }
        } else {
          console.error('Failed to fetch session:', response.status, response.statusText)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Failed to fetch session:", error)
        setIsLoading(false)
      }
    }

    fetchSession()
  }, [sessionId, authChecked])

  // 文字起こしを自動スクロール
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [segments])

  // STTのsegmentsをtranscript segmentsに追加
  useEffect(() => {
    sttSegments.forEach((segment) => {
      // interimセグメントは追加せず、finalセグメントのみを追加
      if (!segment.is_final) return

      // 重複を避けるために、既存のsegmentsに含まれていない場合のみ追加
      const exists = segments.some((s) => s.id === segment.id)
      if (!exists) {
        console.log(`[Adding Final Segment] "${segment.text}" (${segment.text.length}文字)`)
        addSegment(segment)
      }
    })
  }, [sttSegments, segments, addSegment])

  // segmentsが変更されたら、finalセグメント数をチェックして更新をトリガー
  const previousFinalSegmentCount = useRef(0)
  useEffect(() => {
    const currentFinalSegments = getFinalSegments()
    const currentCount = currentFinalSegments.length
    const totalText = currentFinalSegments.map(s => s.text).join(' ')

    console.log(`[Segments State] Total: ${segments.length}, Final: ${currentCount}, Text length: ${totalText.length}`)

    // finalセグメント数が増えたら、インサイト/提案を更新
    if (currentCount > previousFinalSegmentCount.current && sttStatus === "connected") {
      console.log(`[Final Segments Changed] ${previousFinalSegmentCount.current} → ${currentCount}, triggering update`)
      previousFinalSegmentCount.current = currentCount

      // 少し遅延させてから更新（複数セグメントが連続して追加される場合の対応）
      setTimeout(() => {
        console.log('[Delayed Update] Calling refreshInsight/refreshSuggestions')
        refreshInsightRef.current?.()
        refreshSuggestionsRef.current?.()
      }, 1000)
    }
  }, [segments, getFinalSegments, sttStatus])

  // STTエラーメッセージを監視
  useEffect(() => {
    if (sttErrorMessage) {
      setSttError(sttErrorMessage)
    }
  }, [sttErrorMessage])

  // finalSegmentsとinterimSegmentを計算（UI表示用）
  const finalSegments = getFinalSegments()
  const interimSegment = getInterimSegment()

  // インサイト更新（useCallback内でgetFinalSegmentsを呼び出して常に最新値を取得）
  const refreshInsight = useCallback(async () => {
    try {
      // 文字起こしの統計情報を計算（常に最新のセグメントを取得）
      const currentSegments = getFinalSegments()
      const transcriptText = currentSegments.map(s => s.text).join(' ')
      const stats = {
        totalSegments: currentSegments.length,
        totalLength: transcriptText.length,
        lastUpdate: new Date().toISOString()
      }

      console.log('[refreshInsight] Updating with stats:', stats)

      // 統計情報と文字起こしテキストを含めてAPIを呼び出す
      const statsParam = encodeURIComponent(JSON.stringify(stats))
      const transcriptParam = encodeURIComponent(transcriptText)
      const response = await fetch(`/api/insight?session_id=${sessionId}&stats=${statsParam}&transcript=${transcriptParam}`)
      if (response.ok) {
        const data = await response.json()
        if (data?.insight && typeof data.insight === 'object') {
          console.log('[refreshInsight] Setting insight:', data.insight.summary_text?.substring(0, 50))
          setInsight(data.insight)
        }
      }
    } catch (error) {
      console.error("Failed to fetch insight:", error)
    }
  }, [sessionId, getFinalSegments])

  // 提案更新（useCallback内でgetFinalSegmentsを呼び出して常に最新値を取得）
  const refreshSuggestions = useCallback(async () => {
    try {
      // 文字起こしの統計情報を計算（常に最新のセグメントを取得）
      const currentSegments = getFinalSegments()
      const transcriptText = currentSegments.map(s => s.text).join(' ')
      const stats = {
        totalSegments: currentSegments.length,
        totalLength: transcriptText.length,
        lastUpdate: new Date().toISOString()
      }

      console.log('[refreshSuggestions] Updating with stats:', stats)

      // 統計情報と文字起こしテキストを含めてAPIを呼び出す
      const statsParam = encodeURIComponent(JSON.stringify(stats))
      const transcriptParam = encodeURIComponent(transcriptText)
      const response = await fetch(`/api/suggestions?session_id=${sessionId}&stats=${statsParam}&transcript=${transcriptParam}`)
      if (response.ok) {
        const data = await response.json()
        if (data?.suggestions && typeof data.suggestions === 'object') {
          console.log('[refreshSuggestions] Setting suggestions:', data.suggestions.questions?.length, 'questions')
          setSuggestions(data.suggestions)
        }
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error)
    }
  }, [sessionId, getFinalSegments])

  // refを更新（triggerAnalysisが常に最新の関数を呼び出せるように）
  useEffect(() => {
    refreshInsightRef.current = refreshInsight
  }, [refreshInsight])

  useEffect(() => {
    refreshSuggestionsRef.current = refreshSuggestions
  }, [refreshSuggestions])

  // 分析トリガー関数
  const triggerAnalysis = useCallback(async () => {
    try {
      // 開発環境ではFunctionsを呼ばずに直接インサイト/提案を更新
      if (process.env.NODE_ENV !== "production") {
        console.log('Development mode: Refreshing insights/suggestions directly')
        // refを使って最新の関数を呼び出す
        await Promise.all([
          refreshInsightRef.current?.(),
          refreshSuggestionsRef.current?.()
        ])
        return
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseAnonKey && userId) {
        console.log('Triggering analysis for session:', sessionId)
        const functionUrl = `${supabaseUrl}/functions/v1/analysis-triggered`

        await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseAnonKey,
          },
          body: JSON.stringify({
            sessionId,
            triggerType: "interval",
            userId,
          }),
        })

        // インサイトと提案を更新（refを使って最新の関数を呼び出す）
        await Promise.all([
          refreshInsightRef.current?.(),
          refreshSuggestionsRef.current?.()
        ])
        console.log('Analysis triggered and insights/suggestions refreshed')
      }
    } catch (error) {
      console.error("Failed to trigger analysis:", error)
    }
  }, [sessionId, userId])

  // 定期分析（10秒ごと）
  useEffect(() => {
    if (sttStatus !== "connected") return

    // セッション開始時に最初の分析をスケジュール
    const initialTimer = setTimeout(() => {
      triggerAnalysis()
    }, 10000)

    // その後は10秒ごとに分析を実行
    const interval = setInterval(() => {
      triggerAnalysis()
    }, 10000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [sttStatus, triggerAnalysis])

  // 初期化時にインサイトと提案を取得
  useEffect(() => {
    if (!authChecked || !sessionId) return

    const loadInitialData = async () => {
      await refreshInsight()
      await refreshSuggestions()
    }

    loadInitialData()
  }, [authChecked, sessionId])

  // セッション開始時の処理
  const handleSessionStart = useCallback(async () => {
    try {
      // 開発環境ではFunctionsを呼ばない
      if (process.env.NODE_ENV !== "production") {
        console.log('Development mode: Skipping session-started Supabase Function')
        return
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseAnonKey && userId) {
        console.log('Starting session:', sessionId)
        const functionUrl = `${supabaseUrl}/functions/v1/session-started`

        await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseAnonKey,
          },
          body: JSON.stringify({ sessionId, userId }),
        })
        console.log('Session started successfully')
      }
    } catch (error) {
      console.error("Failed to start session:", error)
    }
  }, [sessionId, userId])

  // 録音開始
  const handleStartMeeting = async () => {
    await handleSessionStart()
    await connect()
    // Web Speech APIでは、connect()の中で自動的に音声認識が開始される
  }

  // 録音停止
  const handleStopMeeting = async () => {
    disconnect()

    // 最終サマリーを生成
    const finalSegments = getFinalSegments()
    if (finalSegments.length > 0) {
      // Inngestイベントを送信
      try {
        await fetch("/api/session/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        })
      } catch (error) {
        console.error("Failed to complete session:", error)
      }
    }
  }

  // ローディング中の表示
  if (isLoading) {
    return (
      <main className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">セッション情報を読み込み中...</p>
        </div>
      </main>
    )
  }

  if (!authChecked) {
    return (
      <main className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">認証確認中...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">{session?.meeting_title || session?.title || "会議"}</h1>
          <p className="text-sm text-gray-500">{session?.client_name}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 言語選択 */}
          <Select value={currentLanguage} onValueChange={(value) => setCurrentLanguage(value as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge
            variant={
              sttStatus === "connected"
                ? "default"
                : sttStatus === "connecting"
                ? "secondary"
                : "outline"
            }
          >
            {sttStatus === "connected"
              ? "接続中"
              : sttStatus === "connecting"
              ? "接続中..."
              : "未接続"}
          </Badge>
          {sttStatus === "connected" ? (
            <Button variant="destructive" onClick={handleStopMeeting}>
              会議終了
            </Button>
          ) : (
            <Button onClick={handleStartMeeting} disabled={sttStatus === "connecting"}>
              会議開始
            </Button>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左: 文字起こし */}
        <div className="w-1/2 border-r flex flex-col">
          <div className="bg-white px-4 py-2 border-b">
            <h2 className="font-medium">文字起こし</h2>
          </div>
          <ScrollArea className="flex-1 p-4">
            {finalSegments.length === 0 && !interimSegment ? (
              <p className="text-gray-400 text-center py-8">
                会議を開始すると文字起こしが表示されます
              </p>
            ) : (
              <div className="space-y-3">
                {finalSegments.map((segment) => (
                  <div key={segment.id} className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm text-gray-700">{segment.text}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(segment.ts_start * 1000).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
                {interimSegment && (
                  <div className="bg-gray-100 rounded-lg p-3 italic">
                    <p className="text-sm text-gray-500">{interimSegment.text}</p>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 右: インサイト・提案 */}
        <div className="w-1/2 flex flex-col">
          <Tabs defaultValue="insight" className="flex-1 flex flex-col">
            <div className="bg-white px-4 py-2 border-b">
              <TabsList>
                <TabsTrigger value="insight">インサイト</TabsTrigger>
                <TabsTrigger value="suggestions">提案</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="insight" className="flex-1 overflow-hidden" key={`insight-${updateCounter}`}>
              <ScrollArea className="h-full p-4">
                {insight ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">要約</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{insight.summary_text}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">課題</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {insight.pain_points?.map((pain, i) => (
                            <li key={i} className="text-sm">
                              <Badge variant="outline" className="mr-2">
                                {pain.impact}
                              </Badge>
                              {pain.description}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">制約</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {insight.constraints?.map((constraint, i) => (
                            <li key={i} className="text-sm">
                              <Badge variant="secondary" className="mr-2">
                                {constraint.type}
                              </Badge>
                              {constraint.description}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">ステークホルダー</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {insight.stakeholders?.map((stakeholder, i) => (
                            <li key={i} className="text-sm">
                              <span className="font-medium">{stakeholder.name}</span>
                              <span className="text-gray-500 ml-2">({stakeholder.role})</span>
                              <Badge
                                variant={
                                  stakeholder.attitude === "champion"
                                    ? "default"
                                    : stakeholder.attitude === "blocker"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="ml-2"
                              >
                                {stakeholder.attitude}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={refreshInsight}>
                        更新
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <p>インサイトが生成されると表示されます</p>
                    <p className="text-sm mt-2">会議開始から30秒ごとに自動生成されます</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="suggestions" className="flex-1 overflow-hidden" key={`suggestions-${updateCounter}`}>
              <ScrollArea className="h-full p-4">
                {suggestions ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">次に聞くべき質問</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {suggestions.questions?.map((q, i) => (
                            <li key={i} className="bg-gray-50 rounded p-3">
                              <p className="font-medium text-sm">{q.question}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                理由: {q.intent}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">提案カード</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {suggestions.proposals?.map((p, i) => (
                            <li key={i} className="border rounded p-3">
                              <div className="flex justify-between items-start">
                                <p className="font-medium text-sm">{p.title}</p>
                                <Badge
                                  variant={p.confidence === "high" ? "default" : "secondary"}
                                >
                                  {p.confidence}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{p.body}</p>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Button variant="outline" size="sm" onClick={refreshSuggestions}>
                      更新
                    </Button>
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    <p>提案が生成されると表示されます</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {sttError && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-red-800">マイクのエラー</h3>
            <p className="text-sm text-red-700 mt-1">{sttError}</p>
            <p className="text-xs text-red-600 mt-2">
              ブラウザのアドレスバーの鍵マークをクリックして、マイクを許可してください
            </p>
          </div>
          <button
            onClick={() => setSttError(null)}
            className="flex-shrink-0 text-red-400 hover:text-red-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </main>
  )
}
