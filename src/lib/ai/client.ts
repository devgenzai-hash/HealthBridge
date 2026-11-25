/**
 * AI Provider Layer — Pluggable LLM Architecture
 *
 * All AI calls in HealthBridge go through this module.
 * Switch providers by changing the AI_PROVIDER env var.
 * Never call OpenAI SDK directly from feature code.
 */

import OpenAI from 'openai'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIProvider =
  | 'openai'
  | 'openrouter'
  | 'nvidia-nim'
  | 'ollama'
  | 'llama-cpp'
  | 'groq'
  | 'together'
  | 'anthropic'

interface ProviderConfig {
  baseURL: string
  defaultModel: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  responseFormat?: 'text' | 'json'
  /** System prompt prepended to messages */
  systemPrompt?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

// ---------------------------------------------------------------------------
// Provider Registry
// ---------------------------------------------------------------------------

const PROVIDER_CONFIG: Record<AIProvider, ProviderConfig> = {
  openai: { baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini' },
  'nvidia-nim': { baseURL: 'https://integrate.api.nvidia.com/v1', defaultModel: 'meta/llama-3.1-70b-instruct' },
  ollama: { baseURL: 'http://localhost:11434/v1', defaultModel: 'llama3.2' },
  'llama-cpp': { baseURL: 'http://localhost:8080/v1', defaultModel: 'local-model' },
  groq: { baseURL: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  together: { baseURL: 'https://api.together.xyz/v1', defaultModel: 'meta-llama/Llama-3-8b-chat-hf' },
  anthropic: { baseURL: '', defaultModel: 'claude-3-5-haiku-20241022' },
}

// ---------------------------------------------------------------------------
// Client Factory
// ---------------------------------------------------------------------------

let cachedClient: { client: OpenAI; model: string; provider: AIProvider } | null = null

export function getAIClient(): { client: OpenAI; model: string; provider: AIProvider } {
  if (cachedClient) return cachedClient

  const provider = (process.env.AI_PROVIDER as AIProvider) || 'openai'

  if (provider === 'anthropic') {
    throw new Error(
      'Use getAnthropicClient() for Anthropic provider. Set AI_PROVIDER to a different value or import the Anthropic client directly.'
    )
  }

  const config = PROVIDER_CONFIG[provider]
  if (!config) {
    throw new Error(`Unknown AI provider: ${provider}. Supported: ${Object.keys(PROVIDER_CONFIG).join(', ')}`)
  }

  const client = new OpenAI({
    apiKey: process.env.AI_API_KEY || 'ollama',
    baseURL: config.baseURL,
    defaultHeaders:
      provider === 'openrouter'
        ? {
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'HealthBridge',
          }
        : undefined,
  })

  cachedClient = {
    client,
    model: process.env.AI_MODEL || config.defaultModel,
    provider,
  }

  logger.info({ provider, model: cachedClient.model }, 'AI client initialized')
  return cachedClient
}

// ---------------------------------------------------------------------------
// Unified Chat Function
// ---------------------------------------------------------------------------

/**
 * Send a chat completion request through the pluggable AI layer.
 * Use this for ALL AI interactions in HealthBridge.
 *
 * @param messages - Array of chat messages
 * @param options - Temperature, max tokens, response format
 * @returns The AI response text content
 *
 * @example
 * const summary = await chat([
 *   { role: 'system', content: REPORT_ANALYSIS_PROMPT },
 *   { role: 'user', content: `Analyze this report: ${ocrText}` }
 * ], { temperature: 0.2, responseFormat: 'json' })
 */
export async function chat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<string | null> {
  const { client, model, provider } = getAIClient()
  const startTime = Date.now()

  // Prepend system prompt if provided
  const allMessages = options?.systemPrompt
    ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
    : messages

  try {
    const createParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: allMessages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1000,
    }

    // Only add response_format if requested (not all providers support it)
    if (options?.responseFormat === 'json') {
      createParams.response_format = { type: 'json_object' }
    }

    // Only OpenAI supports the 'store' param
    if (provider === 'openai') {
      createParams.store = false
    }

    const response = await client.chat.completions.create(createParams)

    const duration = Date.now() - startTime
    const usage = response.usage

    logger.info(
      {
        provider,
        model,
        duration,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      },
      'AI chat completion successful'
    )

    return response.choices[0]?.message?.content ?? null
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(
      { err: error, provider, model, duration },
      'AI chat completion failed'
    )
    throw error
  }
}

/**
 * Chat with vision capability — for OCR and image analysis.
 * Sends image as base64 data URL.
 */
export async function chatWithVision(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  options?: ChatOptions
): Promise<string | null> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${imageBase64}` },
        },
      ],
    },
  ]

  return chat(messages, {
    ...options,
    maxTokens: options?.maxTokens ?? 2000,
  })
}

// ---------------------------------------------------------------------------
// Anthropic Client (separate SDK)
// ---------------------------------------------------------------------------

let anthropicClient: InstanceType<typeof import('@anthropic-ai/sdk').default> | null = null

export async function getAnthropicClient() {
  if (anthropicClient) return anthropicClient

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  anthropicClient = new Anthropic({
    apiKey: process.env.AI_API_KEY,
  })

  return anthropicClient
}

/**
 * Chat via Anthropic Claude — used when AI_PROVIDER=anthropic
 */
export async function chatAnthropic(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<string | null> {
  const client = await getAnthropicClient()
  const model = process.env.AI_MODEL || PROVIDER_CONFIG.anthropic.defaultModel
  const startTime = Date.now()

  // Separate system prompt from messages
  const systemMessages = messages.filter((m) => m.role === 'system')
  const nonSystemMessages = messages.filter((m) => m.role !== 'system')

  const systemPrompt = [
    options?.systemPrompt,
    ...systemMessages.map((m) => (typeof m.content === 'string' ? m.content : '')),
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 1000,
      system: systemPrompt || undefined,
      messages: nonSystemMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    })

    const duration = Date.now() - startTime
    logger.info(
      {
        provider: 'anthropic',
        model,
        duration,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      'Anthropic chat completion successful'
    )

    const textBlock = response.content.find((b) => b.type === 'text')
    return textBlock && 'text' in textBlock ? textBlock.text : null
  } catch (error) {
    logger.error({ err: error, provider: 'anthropic', model }, 'Anthropic chat completion failed')
    throw error
  }
}

// ---------------------------------------------------------------------------
// Universal chat function (auto-routes to correct provider)
// ---------------------------------------------------------------------------

/**
 * Universal AI chat — routes to the correct provider automatically.
 * Use this as the single entry point for all AI features.
 */
export async function aiChat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<string | null> {
  const provider = (process.env.AI_PROVIDER as AIProvider) || 'openai'

  if (provider === 'anthropic') {
    return chatAnthropic(messages, options)
  }

  return chat(messages, options)
}
