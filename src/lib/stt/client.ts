// ブラウザ内Whisper STTクライアント（Deepgram代替）
import { WhisperSTT, type WhisperModelSize } from "./whisper-client"
import type { TranscriptSegment } from "@/types"

// 環境変数からモデルサイズを取得
function getWhisperModelSize(): WhisperModelSize {
  const envModel = process.env.NEXT_PUBLIC_WHISPER_MODEL_SIZE as WhisperModelSize
  if (envModel && ['tiny', 'base', 'small'].includes(envModel)) {
    return envModel
  }
  return 'base'
}

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
}

// WhisperベースのSTT接続を作成
export function createBrowserSTTConnection(
  sessionId: string,
  callbacks: STTCallbacks
): STTConnection | null {
  let isConnected = false
  let audioChunks: Float32Array[] = []
  let processingInterval: NodeJS.Timeout | null = null
  let whisperInstance: WhisperSTT | null = null

  // Whisperインスタンスを初期化
  const initWhisper = async () => {
    whisperInstance = new WhisperSTT(
      {
        onStatusChange: (status) => {
          console.log("Whisper status:", status)
          if (status === "ready") {
            isConnected = true
            callbacks.onConnected()
          } else if (status === "error") {
            callbacks.onError(new Error("Whisper initialization failed"))
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
      },
      getWhisperModelSize()
    )

    try {
      await whisperInstance.loadModel()
    } catch (error) {
      callbacks.onError(error as Error)
    }
  }

  // 処理中の音声を定期的に文字起こし
  const processAudioQueue = async () => {
    if (!whisperInstance || audioChunks.length === 0) return

    // 音声チャンクを結合
    const totalLength = audioChunks.reduce((sum, arr) => sum + arr.length, 0)
    if (totalLength < 16000) {
      // 1秒未満の場合は処理しない
      return
    }

    const combinedAudio = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset)
      offset += chunk.length
    }
    audioChunks = []

    // Whisperに追加して処理
    whisperInstance.addAudioData(combinedAudio)
    await whisperInstance.processQueue()
  }

  // 初期化開始
  initWhisper()

  // 定期的に音声を処理（5秒ごと）
  processingInterval = setInterval(processAudioQueue, 5000)

  return {
    send: (data: ArrayBuffer) => {
      if (!isConnected) return

      // Int16ArrayをFloat32Arrayに変換
      const int16Data = new Int16Array(data)
      const float32Data = new Float32Array(int16Data.length)
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0
      }

      audioChunks.push(float32Data)

      // 30秒分溜まったら即座に処理
      const totalSamples = audioChunks.reduce((sum, arr) => sum + arr.length, 0)
      if (totalSamples >= 16000 * 30) {
        processAudioQueue()
      }
    },
    close: () => {
      if (processingInterval) {
        clearInterval(processingInterval)
        processingInterval = null
      }

      // 残りの音声を処理
      if (audioChunks.length > 0 && whisperInstance) {
        const totalLength = audioChunks.reduce((sum, arr) => sum + arr.length, 0)
        const combinedAudio = new Float32Array(totalLength)
        let offset = 0
        for (const chunk of audioChunks) {
          combinedAudio.set(chunk, offset)
          offset += chunk.length
        }
        audioChunks = []
        whisperInstance.addAudioData(combinedAudio)
        whisperInstance.processQueue()
      }

      if (whisperInstance) {
        whisperInstance.dispose()
        whisperInstance = null
      }

      isConnected = false
      callbacks.onDisconnected()
    },
    get isConnected() {
      return isConnected
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
