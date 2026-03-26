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

  const response = await llmClient.chat.completions.create({
    model: options?.model || "deepseek-chat",
    messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 2000,
  })

  return response.choices[0].message
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
