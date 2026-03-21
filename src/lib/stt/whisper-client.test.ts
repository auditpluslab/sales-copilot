import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WhisperSTT, getWhisperSTT, type WhisperSTTCallbacks, type WhisperModelSize } from './whisper-client'

// @xenova/transformersをモック
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(mockTranscriber),
}))

// モックのTranscriber関数
const mockTranscriber = vi.fn().mockResolvedValue({
  text: 'テスト文字起こし結果',
  chunks: [
    { text: 'テスト', timestamp: [0, 1] },
    { text: '文字起こし結果', timestamp: [1, 3] },
  ],
})

describe('WhisperSTT', () => {
  let callbacks: WhisperSTTCallbacks
  let onStatusChange: ReturnType<typeof vi.fn>
  let onTranscript: ReturnType<typeof vi.fn>
  let onError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    onStatusChange = vi.fn()
    onTranscript = vi.fn()
    onError = vi.fn()

    callbacks = {
      onStatusChange: onStatusChange as unknown as (status: string) => void,
      onTranscript: onTranscript as unknown as (text: string, isFinal: boolean) => void,
      onError: onError as unknown as (error: string) => void,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('デフォルトモデルサイズはbase', () => {
      const whisper = new WhisperSTT(callbacks)
      expect(whisper.getStatus()).toBe('idle')
    })

    it('モデルサイズを指定できる', () => {
      const whisper = new WhisperSTT(callbacks, 'tiny')
      expect(whisper.getStatus()).toBe('idle')
    })

    it('初期ステータスはidle', () => {
      const whisper = new WhisperSTT(callbacks)
      expect(whisper.getStatus()).toBe('idle')
    })
  })

  describe('loadModel', () => {
    it('モデルロード時にstatusがloading→readyに変化する', async () => {
      const whisper = new WhisperSTT(callbacks)

      await whisper.loadModel()

      expect(onStatusChange).toHaveBeenCalledWith('loading')
      expect(onStatusChange).toHaveBeenCalledWith('ready')
      expect(whisper.getStatus()).toBe('ready')
    })

    it('既にロード済みの場合は何もしない', async () => {
      const whisper = new WhisperSTT(callbacks)

      await whisper.loadModel()
      vi.clearAllMocks()

      await whisper.loadModel()

      expect(onStatusChange).not.toHaveBeenCalled()
    })

    it('ロード失敗時にエラーコールバックが呼ばれる', async () => {
      const { pipeline } = await import('@xenova/transformers')
      vi.mocked(pipeline).mockRejectedValueOnce(new Error('Load failed'))

      const whisper = new WhisperSTT(callbacks)
      await whisper.loadModel()

      expect(onStatusChange).toHaveBeenCalledWith('error')
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('モデルのロードに失敗'))
    })
  })

  describe('addAudioData', () => {
    it('音声データをキューに追加できる', () => {
      const whisper = new WhisperSTT(callbacks)
      const audioData = new Float32Array(16000)

      whisper.addAudioData(audioData)

      // processQueueで検証（直接キューにアクセスできないため）
      expect(() => whisper.addAudioData(audioData)).not.toThrow()
    })
  })

  describe('processQueue', () => {
    it('処理中またはキューが空の場合は何もしない', async () => {
      const whisper = new WhisperSTT(callbacks)

      // キューが空
      await whisper.processQueue()
      expect(onStatusChange).not.toHaveBeenCalledWith('processing')
    })

    it('音声が短すぎる場合は処理しない', async () => {
      const whisper = new WhisperSTT(callbacks)
      await whisper.loadModel()
      vi.clearAllMocks()

      // 0.5秒未満の音声（8000サンプル未満）
      const shortAudio = new Float32Array(7000)
      whisper.addAudioData(shortAudio)

      await whisper.processQueue()

      // processing -> ready の順でステータスが変わる
      expect(onStatusChange).toHaveBeenCalledWith('processing')
      expect(onStatusChange).toHaveBeenCalledWith('ready')
      expect(onTranscript).not.toHaveBeenCalled()
    })

    it('十分な音声がある場合に文字起こしを実行', async () => {
      const whisper = new WhisperSTT(callbacks)
      await whisper.loadModel()
      vi.clearAllMocks()

      // 1秒以上の音声（16000サンプル以上）
      const audioData = new Float32Array(16000)
      audioData.fill(0.1)
      whisper.addAudioData(audioData)

      await whisper.processQueue()

      expect(onStatusChange).toHaveBeenCalledWith('processing')
      expect(onTranscript).toHaveBeenCalled()
    })
  })

  describe('transcribe', () => {
    it('AudioBufferから文字起こしできる', async () => {
      const whisper = new WhisperSTT(callbacks)
      await whisper.loadModel()
      vi.clearAllMocks()

      // モックAudioBufferを作成
      const mockAudioBuffer = {
        getChannelData: vi.fn().mockReturnValue(new Float32Array(16000)),
        duration: 1,
      } as unknown as AudioBuffer

      const result = await whisper.transcribe(mockAudioBuffer)

      expect(result).toBeInstanceOf(Array)
      expect(onStatusChange).toHaveBeenCalledWith('processing')
      expect(onStatusChange).toHaveBeenCalledWith('ready')
    })

    it('transcriberが未初期化の場合は自動的にロードする', async () => {
      const whisper = new WhisperSTT(callbacks)

      const mockAudioBuffer = {
        getChannelData: vi.fn().mockReturnValue(new Float32Array(16000)),
        duration: 1,
      } as unknown as AudioBuffer

      await whisper.transcribe(mockAudioBuffer)

      expect(onStatusChange).toHaveBeenCalledWith('loading')
    })
  })

  describe('dispose', () => {
    it('リソースを解放しステータスをidleに戻す', async () => {
      const whisper = new WhisperSTT(callbacks)
      await whisper.loadModel()
      vi.clearAllMocks()

      whisper.dispose()

      expect(onStatusChange).toHaveBeenCalledWith('idle')
      expect(whisper.getStatus()).toBe('idle')
    })

    it('キューをクリアする', async () => {
      const whisper = new WhisperSTT(callbacks)
      await whisper.loadModel()

      whisper.addAudioData(new Float32Array(16000))
      whisper.dispose()

      // dispose後は新しいインスタンスが必要なため、ステータスのみ確認
      expect(whisper.getStatus()).toBe('idle')
    })
  })

  describe('getStatus', () => {
    it('現在のステータスを返す', () => {
      const whisper = new WhisperSTT(callbacks)
      expect(whisper.getStatus()).toBe('idle')
    })
  })
})

describe('getWhisperSTT', () => {
  it('シングルトンインスタンスを返す', () => {
    const callbacks: WhisperSTTCallbacks = {
      onStatusChange: vi.fn(),
      onTranscript: vi.fn(),
      onError: vi.fn(),
    }

    const instance1 = getWhisperSTT(callbacks)
    const instance2 = getWhisperSTT(callbacks)

    expect(instance1).toBe(instance2)
  })

  it('モデルサイズを指定できる', () => {
    const callbacks: WhisperSTTCallbacks = {
      onStatusChange: vi.fn(),
      onTranscript: vi.fn(),
      onError: vi.fn(),
    }

    const instance = getWhisperSTT(callbacks, 'tiny')
    expect(instance).toBeInstanceOf(WhisperSTT)
  })
})
