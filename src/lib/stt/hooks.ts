"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createBrowserSTTConnection, STTConnection } from "./client"
import type { TranscriptSegment, STTStatus } from "@/types"

interface UseSTTOptions {
  sessionId: string
  autoConnect?: boolean
}

interface UseSTTReturn {
  status: STTStatus
  segments: TranscriptSegment[]
  isConnecting: boolean
  connect: () => void
  disconnect: () => void
  sendAudio: (data: ArrayBuffer) => void
  clearSegments: () => void
}

export function useSTT(options: UseSTTOptions): UseSTTReturn {
  const { sessionId, autoConnect = false } = options

  const [status, setStatus] = useState<STTStatus>("disconnected")
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [isConnecting, setIsConnecting] = useState(false)

  const connectionRef = useRef<STTConnection | null>(null)

  const connect = useCallback(() => {
    if (connectionRef.current || isConnecting) return

    setIsConnecting(true)
    setStatus("connecting")

    const connection = createBrowserSTTConnection(sessionId, {
      onConnected: () => {
        setStatus("connected")
        setIsConnecting(false)
      },
      onDisconnected: () => {
        setStatus("disconnected")
        setIsConnecting(false)
        connectionRef.current = null
      },
      onTranscript: (segment) => {
        setSegments((prev) => {
          if (segment.is_final) {
            // 最終結果として追加
            return [...prev, segment]
          } else {
            // インタラクティブ結果：最後の仮セグメントを更新
            const lastSegment = prev[prev.length - 1]
            if (lastSegment && !lastSegment.is_final) {
              return [...prev.slice(0, -1), segment]
            }
            return [...prev, segment]
          }
        })
      },
      onError: (error) => {
        console.error("STT error:", error)
        setStatus("error")
        setIsConnecting(false)
      },
    })

    if (connection) {
      connectionRef.current = connection
    } else {
      // Whisperの初期化に失敗した場合
      setStatus("error")
      setIsConnecting(false)
    }
  }, [sessionId, isConnecting])

  const disconnect = useCallback(() => {
    if (connectionRef.current) {
      connectionRef.current.close()
      connectionRef.current = null
    }
    setStatus("disconnected")
    setIsConnecting(false)
  }, [])

  const sendAudio = useCallback((data: ArrayBuffer) => {
    if (connectionRef.current && status === "connected") {
      connectionRef.current.send(data)
    }
  }, [status])

  const clearSegments = useCallback(() => {
    setSegments([])
  }, [])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  return {
    status,
    segments,
    isConnecting,
    connect,
    disconnect,
    sendAudio,
    clearSegments,
  }
}

// 音声録音用フック
interface UseAudioRecorderOptions {
  onAudioData?: (data: ArrayBuffer) => void
}

interface UseAudioRecorderReturn {
  isRecording: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  error: Error | null
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderReturn {
  const { onAudioData } = options

  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)

  const startRecording = useCallback(async () => {
    try {
      setError(null)

      // マイクへのアクセスを要求
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      mediaStreamRef.current = stream

      // AudioContextを作成
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // AudioWorkletを使用して音声データを処理
      const source = audioContext.createMediaStreamSource(stream)

      // AudioWorkletNodeを作成（カスタムプロセッサが必要）
      // 簡易版としてScriptProcessorNodeを使用
      const bufferSize = 4096
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)

      processor.onaudioprocess = (event) => {
        if (!isRecording) return

        const inputData = event.inputBuffer.getChannelData(0)
        // Float32をInt16に変換
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        if (onAudioData) {
          onAudioData(pcmData.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)
    } catch (err) {
      setError(err as Error)
      console.error("Failed to start recording:", err)
    }
  }, [onAudioData, isRecording])

  const stopRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setIsRecording(false)
  }, [])

  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [stopRecording])

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
  }
}

// 文字起こしセグメント管理用フック
interface UseTranscriptSegmentsOptions {
  maxSegments?: number
}

interface UseTranscriptSegmentsReturn {
  segments: TranscriptSegment[]
  addSegment: (segment: TranscriptSegment) => void
  updateSegment: (id: string, updates: Partial<TranscriptSegment>) => void
  removeSegment: (id: string) => void
  clearSegments: () => void
  getFinalSegments: () => TranscriptSegment[]
  getInterimSegment: () => TranscriptSegment | null
}

export function useTranscriptSegments(options: UseTranscriptSegmentsOptions = {}): UseTranscriptSegmentsReturn {
  const { maxSegments = 1000 } = options

  const [segments, setSegments] = useState<TranscriptSegment[]>([])

  const addSegment = useCallback((segment: TranscriptSegment) => {
    setSegments((prev) => {
      const newSegments = [...prev, segment]
      // 最大数を超えたら古いものから削除
      if (newSegments.length > maxSegments) {
        return newSegments.slice(-maxSegments)
      }
      return newSegments
    })
  }, [maxSegments])

  const updateSegment = useCallback((id: string, updates: Partial<TranscriptSegment>) => {
    setSegments((prev) =>
      prev.map((seg) => (seg.id === id ? { ...seg, ...updates } : seg))
    )
  }, [])

  const removeSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((seg) => seg.id !== id))
  }, [])

  const clearSegments = useCallback(() => {
    setSegments([])
  }, [])

  const getFinalSegments = useCallback(() => {
    return segments.filter((seg) => seg.is_final)
  }, [segments])

  const getInterimSegment = useCallback(() => {
    const interimSegments = segments.filter((seg) => !seg.is_final)
    return interimSegments.length > 0 ? interimSegments[interimSegments.length - 1] : null
  }, [segments])

  return {
    segments,
    addSegment,
    updateSegment,
    removeSegment,
    clearSegments,
    getFinalSegments,
    getInterimSegment,
  }
}
