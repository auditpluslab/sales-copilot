"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WarningAlert } from "@/components/ui/warning-alert"
import { useSTT, useTranscriptSegments } from "@/lib/stt/hooks"
import { LANGUAGE_OPTIONS } from "@/lib/stt/web-speech-client"
import { useToast } from "@/components/ui/use-toast"
import type { SuggestionCard, DeepDiveQuestion, Session } from "@/types"

// デバッグフラグ - 本番環境ではfalse
const DEBUG = process.env.NODE_ENV !== "production"

// 提案生成の最小条件（定数）
const MIN_SEGMENTS = 3
const MIN_TEXT_LENGTH = 100

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
  const [duplicateWarnings, setDuplicateWarnings] = useState<{
    duplicateQuestions?: number
    duplicateProposals?: number
  } | null>(null)

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

  // STTのsegmentsをsegments segmentsに追加
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
    // 条件: 3セグメント以上 && 100文字以上（バックグラウンド事前生成）
    const shouldUpdate = currentCount > previousFinalSegmentCount.current &&
                        sttStatus === "connected" &&
                        currentCount >= MIN_SEGMENTS &&
                        totalText.length >= MIN_TEXT_LENGTH

    if (shouldUpdate) {
      console.log(`[Final Segments Changed] ${previousFinalSegmentCount.current} → ${currentCount}, text: ${totalText.length}, triggering IMMEDIATE update (no delay)`)
      previousFinalSegmentCount.current = currentCount

      // 即座に実行（バックグラウンド事前生成）
      if (DEBUG) console.log('[Immediate Update] Calling refreshSuggestions')
      refreshSuggestionsRef.current?.()
    } else if (currentCount > previousFinalSegmentCount.current && sttStatus === "connected") {
      console.log(`[Final Segments Changed] ${previousFinalSegmentCount.current} → ${currentCount}, text: ${totalText.length}, not enough context yet (need ${MIN_SEGMENTS}+ segments and ${MIN_TEXT_LENGTH}+ chars)`)
      previousFinalSegmentCount.current = currentCount
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
      let segmentsText = currentSegments.map(s => s.text).join(' ')

      const stats = {
        totalSegments: currentSegments.length,
        totalLength: segmentsText.length,
        lastUpdate: new Date().toISOString()
      }

      if (DEBUG) console.log('[refreshSuggestions] Updating with stats:', stats)

      // 最小条件チェック: 3セグメント以上 && 100文字以上
      if (currentSegments.length < MIN_SEGMENTS || segmentsText.length < MIN_TEXT_LENGTH) {
        console.log(`[refreshSuggestions] Not enough context yet: ${currentSegments.length} segments (need ${MIN_SEGMENTS}+), ${segmentsText.length} chars (need ${MIN_TEXT_LENGTH}+)`)
        setIsLoadingSuggestions(false)
        return
      }
      if (process.env.NEXT_PUBLIC_USE_LLM_IN_DEV === 'true') {
        console.log('[refreshSuggestions] Using dev LLM mode, segments length:', segmentsText.length)
      }

      // 統計情報と文字起こしテキストを含めてAPIを呼び出す
      const statsParam = encodeURIComponent(JSON.stringify(stats))
      const segmentsParam = encodeURIComponent(segmentsText)
      const clientId = session?.client_id || ''
      const clientIdParam = clientId ? `&client_id=${clientId}` : ''

      // タイムアウト付きのfetch（30秒）
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      let response
      try {
        response = await fetch(`/api/suggestions?session_id=${sessionId}&stats=${statsParam}&segments=${segmentsParam}${clientIdParam}`, {
          signal: controller.signal
        })
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          throw new Error('提案の生成がタイムアウトしました（30秒）')
        }
        throw fetchError
      } finally {
        clearTimeout(timeoutId)
      }
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

          // 履歴に追加（最大100件、重複を除外）
          setHistory(prev => {
            const existingQuestionIds = new Set(prev.questions.map(q => q.id))
            const existingProposalIds = new Set(prev.proposals.map(p => p.id))

            const uniqueNewQuestions = newQuestions.filter((q: DeepDiveQuestion) =>
              !existingQuestionIds.has(q.id)
            )
            const uniqueNewProposals = newProposals.filter((p: SuggestionCard) =>
              !existingProposalIds.has(p.id)
            )

            return {
              questions: [...uniqueNewQuestions, ...prev.questions].slice(0, 100),
              proposals: [...uniqueNewProposals, ...prev.proposals].slice(0, 100),
            }
          })

          // 提案を更新
          setSuggestions(newSuggestions)

          // 前回の提案を保存
          previousSuggestionsRef.current = newSuggestions
      } else {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }
    } catch (error: any) {
      console.error("[refreshSuggestions] Failed to fetch suggestions:", error)

      // エラーの種類に応じて適切なメッセージを表示
      let errorMessage = "提案の取得に失敗しました"

      if (error.message?.includes('タイムアウト')) {
        errorMessage = "提案の生成がタイムアウトしました。もう一度お試しください。"
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        errorMessage = "ネットワークエラーが発生しました。接続を確認してください。"
      } else if (error.message?.includes('rate limited') || error.message?.includes('429')) {
        errorMessage = "リクエストが多すぎます。しばらくお待ちください。"
      } else if (error.message) {
        errorMessage = `エラーが発生しました: ${error.message}`
      }

      setApiError(errorMessage)

      // ユーザーにトースト通知
      toast({
        title: "提案の生成に失敗しました",
        description: errorMessage,
        variant: "destructive",
      })
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
    // 認証チェック
    if (!userId && process.env.NODE_ENV === "production") {
      toast({
        title: "認証エラー",
        description: "ログインしてください",
        variant: "destructive",
      })
      return
    }

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

      {/* メインコンテンツ - レスポンシブ2カラムレイアウト */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {/* スキップリンク（アクセシビリティ） */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded z-50"
        >
          メインコンテンツへスキップ
        </a>

        <div className="p-6">
          {/* エラー状態 */}
          {apiError && (
            <Card className="border-red-200 bg-red-50 mb-6">
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

          {/* レスポンシブレイアウト：モバイルはタブ、デスクトップは2カラム */}
          <div className="md:hidden">
            {/* モバイル用タブ切り替え */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "segments" | "suggestions")} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="segments">
                  📝 文字起こし
                </TabsTrigger>
                <TabsTrigger value="suggestions">
                  💡 AI提案
                </TabsTrigger>
              </TabsList>

              {/* 文字起こしタブ（モバイル） */}
              <TabsContent value="segments" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">📝 文字起こし</CardTitle>
                    <CardDescription>会議のリアルタイム文字起こし</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto" role="log" aria-live="polite" aria-atomic="false">
                      {segments.length > 0 ? (
                        segments.map((seg) => (
                          <div key={seg.id} className="bg-gray-50 rounded p-3 border border-gray-200">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-xs text-gray-500">
                                {new Date(seg.ts_start).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                {seg.speaker || 'Speaker'}
                              </span>
                            </div>
                            <p className="text-sm">{seg.text}</p>
                            {!seg.is_final && (
                              <span className="text-xs text-gray-400 italic">（仮）</span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-center py-8">
                          まだ文字起こしがありません
                          <br />
                          <span className="text-xs">「会議開始」ボタンを押して開始してください</span>
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI提案タブ（モバイル） */}
              <TabsContent value="suggestions" className="mt-4">
                {/* 重複警告 */}
                {duplicateWarnings && (
                  <WarningAlert
                    duplicateQuestions={duplicateWarnings.duplicateQuestions || 0}
                    duplicateProposals={duplicateWarnings.duplicateProposals || 0}
                    onDismiss={() => setDuplicateWarnings(null)}
                  />
                )}

                {/* ピン留め/履歴タブ */}
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
                  <TabsContent value="pinned" className="space-y-4 mt-4">
                    {/* ピン留めした質問 */}
                    {pinnedItems.questions.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">💡 ピン留めした質問</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
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
                        </CardContent>
                      </Card>
                    )}

                    {/* ピン留めした提案 */}
                    {pinnedItems.proposals.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">📋 ピン留めした提案</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
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
                                    className="text-xs"
                                  >
                                    {p.confidence === "high" ? "高" : p.confidence === "medium" ? "中" : "低"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{p.body}</p>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* ピン留めがない場合 */}
                    {pinnedItems.questions.length === 0 && pinnedItems.proposals.length === 0 && (
                      <Card>
                        <CardContent className="py-8">
                          <p className="text-gray-400 text-center text-sm">
                            ピン留めした提案はありません
                            <br />
                            <span className="text-xs">トースト通知の「ピン留め」ボタンで追加できます</span>
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* 履歴タブ */}
                  <TabsContent value="history" className="space-y-4 mt-4">
                    {/* 履歴質問 */}
                    {history.questions.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">💡 質問の履歴</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
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
                        </CardContent>
                      </Card>
                    )}

                    {/* 履歴提案 */}
                    {history.proposals.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">📋 提案の履歴</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {history.proposals.map((p) => (
                              <li key={p.id} className="bg-gray-50 rounded p-3 relative">
                                {isPinned("proposal", p.id) && (
                                  <span className="absolute top-2 right-2 text-blue-500 text-xs">📌</span>
                                )}
                                <div className="flex justify-between items-start pr-8">
                                  <p className="font-medium text-sm">{p.title}</p>
                                  <Badge
                                    variant={p.confidence === "high" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {p.confidence === "high" ? "高" : p.confidence === "medium" ? "中" : "低"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{p.body}</p>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {/* 履歴がない場合 */}
                    {history.questions.length === 0 && history.proposals.length === 0 && (
                      <Card>
                        <CardContent className="py-8">
                          <p className="text-gray-400 text-center text-sm">
                            まだ提案がありません
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>

                {/* 更新インジケーター */}
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-4 pt-4 border-t">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span>10秒ごとに更新中...</span>
                  {isLoadingSuggestions && <span>（更新中）</span>}
                </div>

                {/* 手動更新ボタン */}
                <div className="flex justify-center mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      (e.currentTarget as HTMLButtonElement).disabled = true
                      refreshSuggestions()
                      setTimeout(() => {
                        (e.currentTarget as HTMLButtonElement).disabled = false
                      }, 1000)
                    }}
                    disabled={isLoadingSuggestions}
                  >
                    {isLoadingSuggestions ? "更新中..." : "🔄 手動更新"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* デスクトップ用2カラムレイアウト */}
          <div className="hidden md:grid md:grid-cols-[1fr_400px] md:gap-6" id="main-content">
            {/* 左カラム：文字起こしセクション */}
            <section aria-labelledby="segments-heading" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle id="segments-heading" className="text-lg">📝 文字起こし</CardTitle>
                  <CardDescription>会議のリアルタイム文字起こし</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto" role="log" aria-live="polite" aria-atomic="false">
                    {segments.length > 0 ? (
                      segments.map((seg) => (
                        <div key={seg.id} className="bg-gray-50 rounded p-3 border border-gray-200">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs text-gray-500">
                              {new Date(seg.ts_start).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                              {seg.speaker || 'Speaker'}
                            </span>
                          </div>
                          <p className="text-sm">{seg.text}</p>
                          {!seg.is_final && (
                            <span className="text-xs text-gray-400 italic">（仮）</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-400 text-center py-8">
                        まだ文字起こしがありません
                        <br />
                        <span className="text-xs">「会議開始」ボタンを押して開始してください</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* 右カラム：AI提案セクション */}
            <section aria-labelledby="suggestions-heading" className="space-y-4">
              {/* 重複警告 */}
              {duplicateWarnings && (
                <WarningAlert
                  duplicateQuestions={duplicateWarnings.duplicateQuestions || 0}
                  duplicateProposals={duplicateWarnings.duplicateProposals || 0}
                  onDismiss={() => setDuplicateWarnings(null)}
                />
              )}

              <Card>
                <CardHeader>
                  <CardTitle id="suggestions-heading" className="text-lg">💡 AI提案</CardTitle>
                  <CardDescription>会議に基づいた提案</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* ピン留め/履歴タブ */}
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
                    <TabsContent value="pinned" className="space-y-4 mt-4">
                      {/* ピン留めした質問 */}
                      {pinnedItems.questions.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">💡 ピン留めした質問</h3>
                          <ul className="space-y-2">
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
                        </div>
                      )}

                      {/* ピン留めした提案 */}
                      {pinnedItems.proposals.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">📋 ピン留めした提案</h3>
                          <ul className="space-y-2">
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
                                    className="text-xs"
                                  >
                                    {p.confidence === "high" ? "高" : p.confidence === "medium" ? "中" : "低"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{p.body}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* ピン留めがない場合 */}
                      {pinnedItems.questions.length === 0 && pinnedItems.proposals.length === 0 && (
                        <p className="text-gray-400 text-center py-8 text-sm">
                          ピン留めした提案はありません
                          <br />
                          <span className="text-xs">トースト通知の「ピン留め」ボタンで追加できます</span>
                        </p>
                      )}
                    </TabsContent>

                    {/* 履歴タブ */}
                    <TabsContent value="history" className="space-y-4 mt-4">
                      {/* 履歴質問 */}
                      {history.questions.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">💡 質問の履歴</h3>
                          <ul className="space-y-2">
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
                        </div>
                      )}

                      {/* 履歴提案 */}
                      {history.proposals.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2">📋 提案の履歴</h3>
                          <ul className="space-y-2">
                            {history.proposals.map((p) => (
                              <li key={p.id} className="bg-gray-50 rounded p-3 relative">
                                {isPinned("proposal", p.id) && (
                                  <span className="absolute top-2 right-2 text-blue-500 text-xs">📌</span>
                                )}
                                <div className="flex justify-between items-start pr-8">
                                  <p className="font-medium text-sm">{p.title}</p>
                                  <Badge
                                    variant={p.confidence === "high" ? "default" : "secondary"}
                                    className="text-xs"
                                  >
                                    {p.confidence === "high" ? "高" : p.confidence === "medium" ? "中" : "低"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{p.body}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 履歴がない場合 */}
                      {history.questions.length === 0 && history.proposals.length === 0 && (
                        <p className="text-gray-400 text-center py-8 text-sm">
                          まだ提案がありません
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* 更新インジケーター */}
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-4 pt-4 border-t">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span>10秒ごとに更新中...</span>
                    {isLoadingSuggestions && <span>（更新中）</span>}
                  </div>

                  {/* 手動更新ボタン */}
                  <div className="flex justify-center mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        (e.currentTarget as HTMLButtonElement).disabled = true
                        refreshSuggestions()
                        setTimeout(() => {
                          (e.currentTarget as HTMLButtonElement).disabled = false
                        }, 1000)
                      }}
                      disabled={isLoadingSuggestions}
                    >
                      {isLoadingSuggestions ? "更新中..." : "🔄 手動更新"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
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
