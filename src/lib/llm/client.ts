import OpenAI from "openai"

// Custom message type that supports all roles
export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

// DeepSeek API (OpenAI-compatible)
const apiKey = process.env.DEEPSEEK_API_KEY
const baseURL = "https://api.deepseek.com"

if (!apiKey) {
  console.warn("DEEPSEEK_API_KEY is not set - LLM features will not work")
}

export const llmClient = new OpenAI({
  apiKey,
  baseURL,
})

export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
    responseFormat?: "json_object" | "text"
  }
) {
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set")
  }

  const maxRetries = 3
  const baseDelay = 1000 // 1秒

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await llmClient.chat.completions.create({
        model: options?.model || "deepseek-chat",
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2000,
      })

      // 空レスポンスの検出
      if (!response.choices[0]?.message?.content) {
        console.error(`[LLM] Empty response on attempt ${attempt + 1}/${maxRetries}`)
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.log(`[LLM] Retrying after ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error("LLM returned empty response")
      }

      return response.choices[0].message
    } catch (error: any) {
      // レート制限（429）の場合はリトライ
      if (error.status === 429) {
        console.warn(`[LLM] Rate limited on attempt ${attempt + 1}/${maxRetries}`)
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt) * 2 // 429は倍の待ち時間
          console.log(`[LLM] Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        throw new Error(`LLM rate limited after ${maxRetries} attempts`)
      }

      // タイムアウトまたはネットワークエラーの場合はリトライ
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.message?.includes('timeout')) {
        console.warn(`[LLM] Timeout/network error on attempt ${attempt + 1}/${maxRetries}:`, error.message)
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.log(`[LLM] Retrying after ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }

      // その他のエラーは即座にスロー
      throw error
    }
  }

  throw new Error(`LLM failed after ${maxRetries} attempts`)
}

export async function structuredOutput<T>(
  prompt: string,
  schema: object,
  options?: {
    model?: string
    temperature?: number
  }
): Promise<T> {
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set")
  }

  const schemaDescription = JSON.stringify(schema)

  const response = await llmClient.chat.completions.create({
    model: options?.model || "deepseek-chat",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant. You should respond with a JSON object that matches the following schema:

${schemaDescription}

Only respond with valid JSON. Do not include any explanations or text outside the JSON structure.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: options?.temperature ?? 0.3,
  })

  const content = response.choices[0].message.content || "{}"
  return JSON.parse(content) as T
}
