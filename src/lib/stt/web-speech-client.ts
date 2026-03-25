// Web Speech APIを使用したSTTクライアント（Whisperの代替）

export type WebSpeechSTTStatus = 'idle' | 'loading' | 'ready' | 'processing' | 'error'

export interface WebSpeechSTTCallbacks {
  onStatusChange: (status: WebSpeechSTTStatus) => void
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: string) => void
}

export type SpeechLanguage = 'ja-JP' | 'en-US' | 'zh-CN' | 'zh-TW'

export const LANGUAGE_OPTIONS: { value: SpeechLanguage; label: string }[] = [
  { value: 'ja-JP', label: '日本語' },
  { value: 'en-US', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
]

export class WebSpeechSTT {
  private recognition: SpeechRecognition | webkitSpeechRecognition | null = null
  private status: WebSpeechSTTStatus = 'idle'
  private callbacks: WebSpeechSTTCallbacks
  private isListening = false
  private initializePromise: Promise<void> | null = null
  private currentLanguage: SpeechLanguage = 'ja-JP'

  constructor(callbacks: WebSpeechSTTCallbacks) {
    this.callbacks = callbacks
  }

  // 現在の言語を取得
  getLanguage(): SpeechLanguage {
    return this.currentLanguage
  }

  // 言語を設定（認識中の場合は再起動）
  setLanguage(language: SpeechLanguage): void {
    if (this.currentLanguage === language) return

    console.log(`Changing language from ${this.currentLanguage} to ${language}`)
    this.currentLanguage = language

    // 認識中の場合は再起動
    if (this.recognition && this.isListening) {
      this.stop()
      setTimeout(() => {
        if (this.status === 'ready' || this.status === 'processing') {
          this.start()
        }
      }, 100)
    }
  }

  // Web Speech APIのサポートをチェック
  static isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }

  // 認識を開始
  async initialize(): Promise<void> {
    // 既に初期化中または初期化完了の場合は既存のPromiseを返す
    if (this.initializePromise) {
      return this.initializePromise
    }

    // 既に初期化されている場合は何もしない
    if (this.recognition && this.status !== 'idle') {
      return
    }

    this.initializePromise = this.doInitialize()
    return this.initializePromise
  }

  private async doInitialize(): Promise<void> {
    this.setStatus('loading')

    try {
      // まずマイクの使用許可をリクエスト
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // ストリームを解放（実際には使用しない）
        stream.getTracks().forEach(track => track.stop())
        console.log('Microphone permission granted')
      } catch (error) {
        console.error('Microphone permission denied:', error)
        this.setStatus('error')
        this.callbacks.onError('マイクの使用許可が必要です。ブラウザの設定でマイクを許可してください。')
        this.initializePromise = null
        return
      }

      // SpeechRecognition APIを取得（Safariのwebkitプレフィックスに対応）
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition

      if (!SpeechRecognition) {
        throw new Error('SpeechRecognition API is not supported in this browser')
      }

      // Recognitionインスタンスを作成
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true // 継続的な認識
      this.recognition.interimResults = true // 中間結果も取得
      this.recognition.lang = this.currentLanguage // 設定された言語
      this.recognition.maxAlternatives = 1

      // イベントハンドラを設定
      this.recognition.onstart = () => {
        this.isListening = true
        this.setStatus('processing')
        console.log('Speech recognition started')
      }

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        const results = event.results
        for (let i = event.resultIndex; i < results.length; i++) {
          const result = results[i]
          const transcript = result[0].transcript
          const isFinal = result.isFinal

          console.log(`Speech result: ${transcript} (final: ${isFinal})`)
          this.callbacks.onTranscript(transcript, isFinal)
        }
      }

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)

        // no-speechエラーは停止時や無音時に発生する可能性があるため、重大なエラーとして扱わない
        if (event.error === 'no-speech') {
          console.log('No speech detected (this is normal when stopping or in silence)')
          return
        }

        // not-allowedエラーの場合は、許可を促すメッセージを表示
        if (event.error === 'not-allowed') {
          this.callbacks.onError('マイクの使用許可が必要です。ブラウザのアドレスバーの鍵マークをクリックして、マイクを許可してください。')
        } else {
          const errorMessage = this.getErrorMessage(event.error)
          this.callbacks.onError(errorMessage)
        }

        this.setStatus('error')
      }

      this.recognition.onend = () => {
        console.log('Speech recognition ended')
        this.isListening = false

        // 自動的に再開する（継続的な認識のため）
        if (this.status === 'processing' || (this.recognition && !this.initializePromise)) {
          setTimeout(() => {
            // 初期化中でない、かつインスタンスが存在する場合のみ再開
            if (!this.initializePromise && this.recognition && this.status === 'processing') {
              this.start()
            }
          }, 100)
        } else {
          // 初期化完了
          this.setStatus('ready')
        }
      }

      this.setStatus('ready')
      console.log('Web Speech API initialized successfully')

      // 自動的に認識を開始
      console.log('Starting speech recognition automatically...')
      this.start()

      this.initializePromise = null
    } catch (error) {
      console.error('Web Speech API initialization error:', error)
      this.setStatus('error')
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.callbacks.onError(`Web Speech APIの初期化に失敗: ${errorMessage}`)
      this.initializePromise = null
    }
  }

  // 認識を開始
  start(): void {
    if (!this.recognition) {
      console.error('SpeechRecognition instance is null in start()')
      this.callbacks.onError('SpeechRecognitionが初期化されていません')
      this.setStatus('error')
      return
    }

    if (this.isListening) {
      console.log('Already listening')
      return
    }

    try {
      console.log('Calling recognition.start()...')
      this.recognition.start()
      this.setStatus('processing')
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      this.callbacks.onError(`音声認識の開始に失敗: ${error}`)
      this.setStatus('error')
    }
  }

  // 認識を停止
  stop(): void {
    if (!this.recognition || !this.isListening) {
      return
    }

    try {
      this.recognition.stop()
      this.isListening = false
      this.setStatus('ready')
    } catch (error) {
      console.error('Failed to stop speech recognition:', error)
    }
  }

  // リソース解放
  dispose(): void {
    this.initializePromise = null
    if (this.recognition) {
      this.stop()
      this.recognition = null
    }
    this.setStatus('idle')
  }

  private setStatus(status: WebSpeechSTTStatus): void {
    this.status = status
    this.callbacks.onStatusChange(status)
  }

  getStatus(): WebSpeechSTTStatus {
    return this.status
  }

  private getErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'no-speech': '音声が検出されませんでした',
      'audio-capture': 'マイクへのアクセスが拒否されました',
      'not-allowed': 'マイクの使用許可がありません',
      'network': 'ネットワークエラーが発生しました',
      'aborted': '音声認識が中止されました',
    }

    return errorMessages[error] || `音声認識エラー: ${error}`
  }
}
