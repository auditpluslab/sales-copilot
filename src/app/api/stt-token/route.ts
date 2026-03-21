import { NextResponse } from "next/server"

// Whisper STT状態確認API
// Deepgramトークンは不要になったため、簡素化

// GET /api/stt-token - STT設定状態確認
export async function GET() {
  // ブラウザ内WhisperはAPIキー不要
  return NextResponse.json({
    configured: true,
    engine: "whisper-browser",
    message: "ブラウザ内Whisperを使用します"
  })
}

// POST /api/stt-token - 互換性のため残す
export async function POST() {
  // トークン生成は不要
  return NextResponse.json({
    token: null,
    engine: "whisper-browser",
    message: "ブラウザ内Whisperを使用します"
  })
}
