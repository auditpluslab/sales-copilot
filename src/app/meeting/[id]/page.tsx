"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSTT, useTranscriptSegments } from "@/lib/stt/hooks"
import { LANGUAGE_OPTIONS } from "@/lib/stt/web-speech-client"
import { useToast } from "@/components/ui/use-toast"
import type { SuggestionCard, DeepDiveQuestion, Session } from "@/types"

// デバッグフラグ - 本番環境ではfalse
const DEBUG = process.env.NODE_ENV !== "production"

export default function MeetingPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const { toast } = useToast()

  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [suggestions, setSuggestions] = useState<{
    questions: DeepDiveQuestion[]
    proposals: SuggestionCard[]
  } | null>(null)

  // ピン留めしたアイテム（最大20件）
  const [pinnedItems, setPinnedItems] = useState<{
    questions: DeepDiveQuestion[]
    proposals: SuggestionCard[]
  }>({ questions: [], proposals: [] })

  // 履歴（全てのアイテム、最大100件）
  const [history, setHistory] = useState<{
    questions: DeepDiveQuestion[]
    proposals: SuggestionCard[]
  }>({ questions: [], proposals: [] })

  // アクティブタブ
  const [activeTab, setActiveTab] = useState<"pinned" | "history">("pinned")
  const [sttError, setSttError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  const {
    segments,
    addSegment,
    getFinalSegments,
    getInterimSegment,
  } = useTranscriptSegments()

  const refreshSuggestionsRef = useRef<(() => Promise<void>) | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const previousSuggestionsRef = useRef<{
    questions: DeepDiveQuestion[]
    proposals: SuggestionCard[]
  }>({ questions: [], proposals: [] })

  // ピン留めトグル関数（最大20件）
  const togglePin = useCallback((type: "question" | "proposal", item: DeepDiveQuestion | SuggestionCard) => {
    // バリデーション
    if (!item?.id) {
      console.warn('[togglePin] Invalid item: missing id', item)
      return
    }

    setPinnedItems(prev => {
      const targetType = type === "question" ? "questions" : "proposals"
      const targetArray = prev[targetType]
      const exists = targetArray.some(i => i.id === item.id)

      if (exists) {
        // ピン留め解除
        return {
          ...prev,
          [targetType]: targetArray.filter(i => i.id !== item.id),
        }
      } else {
        // ピン留め追加（最大20件、古い順に解除）
        const MAX_PINNED = 20
        return {
          ...prev,
          [targetType]: [...targetArray, item].slice(-MAX_PINNED),
        }
      }
    })
  }, [])

  // アイテムがピン留めされているかチェック
  const isPinned = useCallback((type: "question" | "proposal", id: string) => {
    const targetArray = type === "question" ? pinnedItems.questions : pinnedItems.proposals
    return targetArray.some(i => i.id === id)
  }, [pinnedItems])

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

  // STTのsegmentsをtranscript segmentsに追加
  useEffect(() => {
    sttSegments.forEach((segment) => {
      // interimセグメントは追加せず、finalセグメントのみを追加
      if (!segment.is_final) return

      // 重複を避けるために、既存のsegmentsに含まれていない場合のみ追加
      const exists = segments.some((s) => s.id === segment.id)
      if (!exists) {
        if (DEBUG) console.log(`[Adding Final Segment] "${segment.text}" (${segment.text.length}文字)`)
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
        if (DEBUG) console.log('[Delayed Update] Calling refreshSuggestions')
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

  // 提案更新（useCallback内でgetFinalSegmentsを呼び出して常に最新値を取得）
  const refreshSuggestions = useCallback(async () => {
    try {
      setIsLoadingSuggestions(true)
      setApiError(null)

      // 文字起こしの統計情報を計算（常に最新のセグメントを取得）
      const currentSegments = getFinalSegments()
      let transcriptText = currentSegments.map(s => s.text).join(' ')

      // 開発環境でLLMをテストするためのダミーデータ
      const useDevLlm = process.env.NEXT_PUBLIC_USE_LLM_IN_DEV === 'true'
      if (useDevLlm && transcriptText.length < 50) {
        transcriptText = `
営業担当者: 本日は御社の業務効率化についてお話しさせてください。まずは、現在の課題から教えていただけますか？

クライアント: はい、現在大きく2つの課題があります。1つ目は、営業案件の管理がExcelで行っていて、進捗の可視化ができていないこと。もう1つは、見積もりの作成に時間がかかっているんです。

営業担当者: 具体的には、どのくらいの時間がかかっていますか？

クライアント: 見積もり作成だけで1件あたり2時間程度かかっています。月に20件ほど作成していて、そのうち40時間くらいを使っている計算になります。

営業担当者: なるほど、40時間ですか。予算の枠はどの程度お考えですか？

クライアント: 今のところ年間300万円程度を考えていますが、効果が見えれば拡大しても良いと思っています。
        `.trim()
      }

      const stats = {
        totalSegments: currentSegments.length,
        totalLength: transcriptText.length,
        lastUpdate: new Date().toISOString()
      }

      if (DEBUG) console.log('[refreshSuggestions] Updating with stats:', stats)
      if (useDevLlm) console.log('[refreshSuggestions] Using dev LLM mode, transcript length:', transcriptText.length)

      // 統計情報と文字起こしテキストを含めてAPIを呼び出す
      const statsParam = encodeURIComponent(JSON.stringify(stats))
      const transcriptParam = encodeURIComponent(transcriptText)
      const clientId = session?.client_id || ''
      const clientIdParam = clientId ? `&client_id=${clientId}` : ''
      const response = await fetch(`/api/suggestions?session_id=${sessionId}&stats=${statsParam}&transcript=${transcriptParam}${clientIdParam}`)
      if (response.ok) {
        const data = await response.json()
        // suggestionsがnullまたはundefinedの場合、空のオブジェクトを使用
        const newSuggestions = (data?.suggestions && typeof data.suggestions === 'object')
          ? data.suggestions
          : { questions: [], proposals: [] }
          if (DEBUG) console.log('[refreshSuggestions] Setting suggestions:', newSuggestions.questions?.length, 'questions')

          // 前回の提案と比較して新しいアイテムを検出
          const prevQuestions = previousSuggestionsRef.current.questions || []
          const prevProposals = previousSuggestionsRef.current.proposals || []
          const newQuestions = newSuggestions.questions || []
          const newProposals = newSuggestions.proposals || []

          // 新しい質問を検出
          const newQuestionsItems = newQuestions.filter((q: DeepDiveQuestion) =>
            !prevQuestions.some((pq: DeepDiveQuestion) => pq.id === q.id)
          )

          // 新しい提案を検出
          const newProposalsItems = newProposals.filter((p: SuggestionCard) =>
            !prevProposals.some((pp: SuggestionCard) => pp.id === p.id)
          )

          // 新しい質問をトースト通知
          newQuestionsItems.forEach((q: DeepDiveQuestion) => {
            const { dismiss } = toast({
              title: "💡 新しい質問",
              description: q.question,
              action: (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    togglePin("question", q)
                    dismiss()
                  }}
                  className="mt-2"
                >
                  ピン留め
                </Button>
              ),
            })
          })

          // 新しい提案をトースト通知
          newProposalsItems.forEach((p: SuggestionCard) => {
            const { dismiss } = toast({
              title: "📋 新しい提案",
              description: p.title,
              action: (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    togglePin("proposal", p)
                    dismiss()
                  }}
                  className="mt-2"
                >
                  ピン留め
                </Button>
              ),
            })
          })

          // priorityが3以上の質問とconfidenceがhighの提案を自動ピン留め
          const autoPinQuestions = newQuestionsItems.filter((q: DeepDiveQuestion) => q.priority >= 3)
          const autoPinProposals = newProposalsItems.filter((p: SuggestionCard) => p.confidence === "high")

          if (autoPinQuestions.length > 0) {
            setPinnedItems(prev => ({
              ...prev,
              questions: [...prev.questions, ...autoPinQuestions],
            }))
          }

          if (autoPinProposals.length > 0) {
            setPinnedItems(prev => ({
              ...prev,
              proposals: [...prev.proposals, ...autoPinProposals],
            }))
          }

          // 履歴に追加（最大100件）
          setHistory(prev => ({
            questions: [...newQuestions, ...prev.questions].slice(0, 100),
            proposals: [...newProposals, ...prev.proposals].slice(0, 100),
          }))

          // 提案を更新
          setSuggestions(newSuggestions)

          // 前回の提案を保存
          previousSuggestionsRef.current = newSuggestions
        }
      } else {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error)
      setApiError("提案の取得に失敗しました")
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [sessionId, getFinalSegments, session, toast, togglePin])

  // refを更新（triggerAnalysisが常に最新の関数を呼び出せるように）
  useEffect(() => {
    refreshSuggestionsRef.current = refreshSuggestions
  }, [refreshSuggestions])

  // 分析トリガー関数
  const triggerAnalysis = useCallback(async () => {
    try {
      // 開発環境ではFunctionsを呼ばずに直接提案を更新
      if (process.env.NODE_ENV !== "production") {
        if (DEBUG) console.log('Development mode: Refreshing suggestions directly')
        // refを使って最新の関数を呼び出す
        await refreshSuggestionsRef.current?.()
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

        // 提案を更新（refを使って最新の関数を呼び出す）
        await refreshSuggestionsRef.current?.()
        console.log('Analysis triggered and suggestions refreshed')
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

  // 初期化時に提案を取得
  useEffect(() => {
    if (!authChecked || !sessionId) return

    const loadInitialData = async () => {
      await refreshSuggestions()
    }

    loadInitialData()
  }, [authChecked, sessionId, refreshSuggestions])

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

      {/* メインコンテンツ - タブで表示切り替え */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* エラー状態 */}
          {apiError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-red-800">エラーが発生しました</p>
                    <p className="text-sm text-red-600 mt-1">{apiError}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshSuggestions}
                    disabled={isLoadingSuggestions}
                  >
                    再読み込み
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* タブ切り替え */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pinned" | "history")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pinned">
                📌 ピン留め ({pinnedItems.questions.length + pinnedItems.proposals.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                📚 履歴 ({history.questions.length + history.proposals.length})
              </TabsTrigger>
            </TabsList>

            {/* ピン留めタブ */}
            <TabsContent value="pinned" className="space-y-6 mt-6">
              {/* ピン留めした質問 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">💡 ピン留めした質問</CardTitle>
                </CardHeader>
                <CardContent>
                  {pinnedItems.questions.length > 0 ? (
                    <ul className="space-y-3">
                      {pinnedItems.questions.map((q) => (
                        <li key={q.id} className="bg-blue-50 border border-blue-200 rounded p-3 relative">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-2 right-2 h-6 w-6 p-0"
                            onClick={() => togglePin("question", q)}
                          >
                            ✕
                          </Button>
                          <p className="font-medium text-sm pr-8">{q.question}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            理由: {q.intent}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-center py-4">
                      ピン留めした質問はありません
                      <br />
                      <span className="text-xs">トースト通知の「ピン留め」ボタンで追加できます</span>
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* ピン留めした提案 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📋 ピン留めした提案</CardTitle>
                </CardHeader>
                <CardContent>
                  {pinnedItems.proposals.length > 0 ? (
                    <ul className="space-y-3">
                      {pinnedItems.proposals.map((p) => (
                        <li key={p.id} className="bg-blue-50 border border-blue-200 rounded p-3 relative">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-2 right-2 h-6 w-6 p-0"
                            onClick={() => togglePin("proposal", p)}
                          >
                            ✕
                          </Button>
                          <div className="flex justify-between items-start pr-8">
                            <p className="font-medium text-sm">{p.title}</p>
                            <Badge
                              variant={p.confidence === "high" ? "default" : "secondary"}
                            >
                              {p.confidence === "high" ? "高確度" : p.confidence === "medium" ? "中確度" : "低確度"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{p.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-center py-4">
                      ピン留めした提案はありません
                      <br />
                      <span className="text-xs">トースト通知の「ピン留め」ボタンで追加できます</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* 履歴タブ */}
            <TabsContent value="history" className="space-y-6 mt-6">
              {/* 履歴質問 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">💡 質問の履歴</CardTitle>
                </CardHeader>
                <CardContent>
                  {history.questions.length > 0 ? (
                    <ul className="space-y-3">
                      {history.questions.map((q) => (
                        <li key={q.id} className="bg-gray-50 rounded p-3 relative">
                          {isPinned("question", q.id) && (
                            <span className="absolute top-2 right-2 text-blue-500 text-xs">📌</span>
                          )}
                          <p className="font-medium text-sm pr-8">{q.question}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            理由: {q.intent}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-center py-4">
                      まだ質問がありません
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* 履歴提案 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📋 提案の履歴</CardTitle>
                </CardHeader>
                <CardContent>
                  {history.proposals.length > 0 ? (
                    <ul className="space-y-3">
                      {history.proposals.map((p) => (
                        <li key={p.id} className="bg-gray-50 rounded p-3 relative">
                          {isPinned("proposal", p.id) && (
                            <span className="absolute top-2 right-2 text-blue-500 text-xs">📌</span>
                          )}
                          <div className="flex justify-between items-start pr-8">
                            <p className="font-medium text-sm">{p.title}</p>
                            <Badge
                              variant={p.confidence === "high" ? "default" : "secondary"}
                            >
                              {p.confidence === "high" ? "高確度" : p.confidence === "medium" ? "中確度" : "低確度"}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{p.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400 text-center py-4">
                      まだ提案がありません
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* 更新インジケーター */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>10秒ごとに更新中...</span>
            {isLoadingSuggestions && <span>（更新中）</span>}
          </div>

          {/* 手動更新ボタン */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={refreshSuggestions}
              disabled={isLoadingSuggestions}
            >
              {isLoadingSuggestions ? "更新中..." : "🔄 手動更新"}
            </Button>
          </div>
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
