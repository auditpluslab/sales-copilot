// ブラウザ内Whisper STT（Transformers.js使用）
// 動的インポートでブラウザ環境でのみロード

export type WhisperSTTStatus = 'idle' | 'loading' | 'ready' | 'processing' | 'error'

export interface WhisperSTTCallbacks {
  onStatusChange: (status: WhisperSTTStatus) => void
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
}

export interface TranscriptSegment {
  id: string
  text: string
  start: number
  end: number
  isFinal: boolean
}

// Pipeline型の定義（@xenova/transformersから）
type TranscriberFunction = (
  audio: Float32Array,
  options?: {
    language?: string
    task?: string
    chunk_length_s?: number
    stride_length_s?: number
    return_timestamps?: boolean
  }
) => Promise<{
  text: string
  chunks?: Array<{
    text: string
    timestamp: [number, number | null]
  }>
}>

export type WhisperModelSize = 'tiny' | 'base' | 'small'

// 環境変数からモデルサイズを取得（デフォルト: base）
function getDefaultModelSize(): WhisperModelSize {
  const envModel = process.env.NEXT_PUBLIC_WHISPER_MODEL_SIZE as WhisperModelSize
  if (envModel && ['tiny', 'base', 'small'].includes(envModel)) {
    return envModel
  }
  return 'base'
}

export class WhisperSTT {
  private transcriber: TranscriberFunction | null = null
  private status: WhisperSTTStatus = 'idle'
  private callbacks: WhisperSTTCallbacks
  private isProcessing = false
  private audioQueue: Float32Array[] = []
  private modelSize: WhisperModelSize

  constructor(callbacks: WhisperSTTCallbacks, modelSize?: WhisperModelSize) {
    this.callbacks = callbacks
    this.modelSize = modelSize ?? getDefaultModelSize()
  }

  // モデルをロード
  async loadModel(): Promise<void> {
    if (this.transcriber) return

    this.setStatus('loading')
    let lastError: Error | null = null

    // リトライ処理（最大3回）
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Loading Whisper model (attempt ${attempt}/3): ${this.modelSize}`)

        // ブラウザ環境でのみTransformers.jsをロード
        const { pipeline, env } = await import('@xenova/transformers')

        // モデルキャッシュの設定
        env.allowLocalModels = false
        env.useBrowserCache = true

        console.log(`Loading Whisper model: ${this.modelSize}`)

        this.transcriber = await pipeline(
          'automatic-speech-recognition',
          `Xenova/whisper-${this.modelSize}`,
          {
            progress_callback: (progress: { status: string; progress?: number }) => {
              if (progress.status === 'progress' && progress.progress) {
                console.log(`Loading model: ${Math.round(progress.progress)}%`)
              } else if (progress.status) {
                console.log(`Model loading: ${progress.status}`)
              }
            },
          }
        ) as TranscriberFunction

        this.setStatus('ready')
        console.log('Whisper model loaded successfully')
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(`Whisper model loading error (attempt ${attempt}/3):`, lastError.message)

        if (attempt < 3) {
          // リトライ前に待機
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
        }
      }
    }

    // すべてのリトライが失敗した場合
    this.setStatus('error')
    const errorMessage = lastError?.message || 'Unknown error'
    this.callbacks.onError(`モデルのロードに失敗: ${errorMessage}`)
  }

  // 音声データをキューに追加
  addAudioData(audioData: Float32Array): void {
    this.audioQueue.push(audioData)
  }

  // キューの音声を処理
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.audioQueue.length === 0 || !this.transcriber) return

    this.isProcessing = true
    this.setStatus('processing')

    try {
      // キューの音声を結合
      const totalLength = this.audioQueue.reduce((sum, arr) => sum + arr.length, 0)

      // 最小の音声長をチェック（0.5秒以上）
      if (totalLength < 8000) {
        this.isProcessing = false
        this.setStatus('ready')
        return
      }

      const combinedAudio = new Float32Array(totalLength)
      let offset = 0
      for (const audio of this.audioQueue) {
        combinedAudio.set(audio, offset)
        offset += audio.length
      }
      this.audioQueue = []

      // 文字起こし実行
      const result = await this.transcriber(combinedAudio, {
        language: 'japanese',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      })

      // 結果をコールバック
      if (result && result.text && result.text.trim()) {
        this.callbacks.onTranscript(result.text.trim(), true)
      }

      this.setStatus('ready')
    } catch (error) {
      this.callbacks.onError(`文字起こしエラー: ${error}`)
      this.setStatus('ready')
    } finally {
      this.isProcessing = false
    }
  }

  // 音声バッファを処理して文字起こし
  async transcribe(audioBuffer: AudioBuffer): Promise<TranscriptSegment[]> {
    if (!this.transcriber) {
      await this.loadModel()
    }

    if (!this.transcriber) {
      throw new Error('Transcriber not initialized')
    }

    this.setStatus('processing')

    try {
      // オーディオをモノラルに変換
      const audioData = audioBuffer.getChannelData(0)

      const result = await this.transcriber(audioData, {
        language: 'japanese',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      })

      this.setStatus('ready')

      const segments: TranscriptSegment[] = []

      if (result.chunks && Array.isArray(result.chunks)) {
        for (const chunk of result.chunks) {
          segments.push({
            id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: chunk.text.trim(),
            start: chunk.timestamp[0] || 0,
            end: chunk.timestamp[1] || 0,
            isFinal: true,
          })
        }
      } else if (result.text) {
        segments.push({
          id: `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: result.text.trim(),
          start: 0,
          end: audioBuffer.duration,
          isFinal: true,
        })
      }

      return segments
    } catch (error) {
      this.setStatus('error')
      throw error
    }
  }

  private setStatus(status: WhisperSTTStatus): void {
    this.status = status
    this.callbacks.onStatusChange(status)
  }

  getStatus(): WhisperSTTStatus {
    return this.status
  }

  // リソース解放
  dispose(): void {
    this.transcriber = null
    this.audioQueue = []
    this.setStatus('idle')
  }
}

// シングルトンインスタンス管理
let whisperInstance: WhisperSTT | null = null

export function getWhisperSTT(callbacks: WhisperSTTCallbacks, modelSize?: WhisperModelSize): WhisperSTT {
  if (!whisperInstance) {
    whisperInstance = new WhisperSTT(callbacks, modelSize)
  }
  return whisperInstance
}
