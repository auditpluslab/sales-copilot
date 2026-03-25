// ブラウザ内STTクライアント（Web Speech API使用）
import { WebSpeechSTT, SpeechLanguage } from "./web-speech-client"
import type { TranscriptSegment } from "@/types"

export interface STTCallbacks {
  onTranscript: (segment: TranscriptSegment) => void
  onConnected: () => void
  onDisconnected: () => void
  onError: (error: Error) => void
}

export interface STTConnection {
  send: (data: ArrayBuffer) => void
  close: () => void
  isConnected: boolean
  setLanguage?: (language: SpeechLanguage) => void
  getLanguage?: () => SpeechLanguage
}

// Web Speech APIベースのSTT接続を作成
export function createBrowserSTTConnection(
  sessionId: string,
  callbacks: STTCallbacks
): STTConnection | null {
  // Web Speech APIのサポートをチェック
  if (!WebSpeechSTT.isSupported()) {
    console.error('Web Speech API is not supported in this browser')
    callbacks.onError(new Error('このブラウザはWeb Speech APIをサポートしていません'))
    return null
  }

  let isConnected = false
  let webSpeechInstance: WebSpeechSTT | null = null

  // Web Speech APIインスタンスを初期化
  const initWebSpeech = async () => {
    webSpeechInstance = new WebSpeechSTT({
      onStatusChange: (status) => {
        console.log("Web Speech status:", status)
        if (status === "ready") {
          isConnected = true
          callbacks.onConnected()
        } else if (status === "error") {
          callbacks.onError(new Error("Web Speech API initialization failed"))
        }
      },
      onTranscript: (text, isFinal) => {
        if (text) {
          const segment: TranscriptSegment = {
            id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            session_id: sessionId,
            ts_start: Date.now() / 1000,
            ts_end: Date.now() / 1000,
            text: text,
            is_final: isFinal,
            source: "browser",
            created_at: new Date().toISOString(),
          }
          callbacks.onTranscript(segment)
        }
      },
      onError: (error) => {
        callbacks.onError(new Error(error))
      },
    })

    try {
      await webSpeechInstance.initialize()
      // initialize()の中で自動的にstart()が呼ばれるので、ここでは呼ばない
      console.log('Web Speech API initialization completed')
    } catch (error) {
      console.error('Web Speech API initialization error:', error)
      callbacks.onError(error as Error)
    }
  }

  // 初期化開始
  initWebSpeech()

  return {
    send: (data: ArrayBuffer) => {
      // Web Speech APIでは音声データを送信する必要がない
      // ブラウザが自動的にマイクから音声を取得する
      if (!isConnected) {
        console.warn('Web Speech API is not connected yet')
      }
    },
    close: () => {
      if (webSpeechInstance) {
        webSpeechInstance.dispose()
        webSpeechInstance = null
      }
      isConnected = false
      callbacks.onDisconnected()
    },
    get isConnected() {
      return isConnected
    },
    setLanguage: (language: SpeechLanguage) => {
      if (webSpeechInstance) {
        webSpeechInstance.setLanguage(language)
      }
    },
    getLanguage: () => {
      return webSpeechInstance ? webSpeechInstance.getLanguage() : 'ja-JP'
    },
  }
}

// サーバーサイド用のダミー関数（使用しない）
export function createSTTConnection(
  sessionId: string,
  callbacks: STTCallbacks
): STTConnection | null {
  console.warn("createSTTConnection is deprecated. Use createBrowserSTTConnection instead.")
  return null
}
