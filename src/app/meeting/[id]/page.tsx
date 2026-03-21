"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSTT, useAudioRecorder, useTranscriptSegments } from "@/lib/stt/hooks"
import type { Insight, SuggestionCard, DeepDiveQuestion, Session } from "@/types"

export default function MeetingPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string

  const [session, setSession] = useState<Session | null>(null)
  const [insight, setInsight] = useState<Insight | null>(null)
  const [suggestions, setSuggestions] = useState<{
    questions: DeepDiveQuestion[]
    proposals: SuggestionCard[]
  } | null>(null)

  const {
    segments,
    addSegment,
    getFinalSegments,
    getInterimSegment,
  } = useTranscriptSegments()

  const {
    status: sttStatus,
    connect,
    disconnect,
    sendAudio,
  } = useSTT({ sessionId })

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // 音声データをSTTに送信
  const { isRecording, startRecording, stopRecording, error: recorderError } = useAudioRecorder({
    onAudioData: (data) => {
      sendAudio(data)
    },
  })

  // セッション情報を取得
  useEffect(() => {
    const fetchSession = async () => {
      if (!sessionId) return

      try {
        const response = await fetch(`/api/session?id=${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setSession(data.session)
        }
      } catch (error) {
        console.error("Failed to fetch session:", error)
      }
    }

    fetchSession()
  }, [sessionId])

  // 文字起こしを自動スクロール
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [segments])

  // 録音開始
  const handleStartMeeting = async () => {
    await connect()
    // 少し待ってから録音開始
    setTimeout(() => {
      startRecording()
    }, 500)
  }

  // 録音停止
  const handleStopMeeting = async () => {
    stopRecording()
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

  // インサイト更新
  const refreshInsight = useCallback(async () => {
    try {
      const response = await fetch(`/api/insight?session_id=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setInsight(data.insight)
      }
    } catch (error) {
      console.error("Failed to fetch insight:", error)
    }
  }, [sessionId])

  // 提案更新
  const refreshSuggestions = useCallback(async () => {
    try {
      const response = await fetch(`/api/suggestions?session_id=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions)
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error)
    }
  }, [sessionId])

  const finalSegments = getFinalSegments()
  const interimSegment = getInterimSegment()

  return (
    <main className="h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">{session?.meeting_title || session?.title || "会議"}</h1>
          <p className="text-sm text-gray-500">{session?.client_name}</p>
        </div>
        <div className="flex items-center gap-3">
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

            <TabsContent value="insight" className="flex-1 overflow-hidden">
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
                    <p className="text-sm mt-2">会議開始から約2分後に自動生成されます</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="suggestions" className="flex-1 overflow-hidden">
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

      {recorderError && (
        <div className="fixed bottom-4 left-4 bg-red-100 text-red-700 px-4 py-2 rounded">
          録音エラー: {recorderError.message}
        </div>
      )}
    </main>
  )
}
