/**
 * Embedding generation for HealthBridge RAG system.
 *
 * Uses text-embedding-3-large (3072 dims) by default — best for medical text.
 * For Ollama local dev: mxbai-embed-large (1024 dims).
 * Dimension configurable via EMBEDDING_DIMENSIONS env var.
 */

import { getAIClient } from './client'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL_DEFAULTS: Record<string, string> = {
  openai: 'text-embedding-3-large',
  openrouter: 'openai/text-embedding-3-large',
  'nvidia-nim': 'nvidia/nv-embedqa-e5-v5',
  ollama: 'mxbai-embed-large',
  'llama-cpp': 'local-embedding-model',
  groq: 'text-embedding-3-large',
  together: 'togethercomputer/m2-bert-80M-8k-retrieval',
}

/** Maximum input length in characters (safety limit to avoid token overflow) */
const MAX_INPUT_LENGTH = 8000

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an embedding vector for the given text.
 * Uses the configured embedding model based on AI_PROVIDER.
 *
 * @param text - Text to embed (truncated to MAX_INPUT_LENGTH)
 * @returns Float array of embedding dimensions
 *
 * @example
 * const embedding = await embed('Patient HbA1c is 7.2%, down from 8.1%')
 * // Store in pgvector column
 */
export async function embed(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot embed empty text')
  }

  const provider = process.env.AI_PROVIDER || 'openai'
  const embeddingModel =
    process.env.EMBEDDING_MODEL || EMBEDDING_MODEL_DEFAULTS[provider] || 'text-embedding-3-large'

  const { client } = getAIClient()
  const truncatedText = text.slice(0, MAX_INPUT_LENGTH)
  const startTime = Date.now()

  try {
    const extraParams: Record<string, unknown> = {}
    // NVIDIA NIM embedding models require input_type parameter
    if (provider === 'nvidia-nim') {
      extraParams.input_type = 'query'
    }

    const response = await client.embeddings.create({
      model: embeddingModel,
      input: truncatedText,
      ...extraParams,
    })

    const duration = Date.now() - startTime
    const embedding = response.data[0].embedding

    // Validate dimensions to fail loudly if the configured model returns vectors
    // that won't fit the pgvector column. Otherwise inserts succeed with junk.
    const expectedDims = getEmbeddingDimensions()
    if (embedding.length !== expectedDims) {
      logger.warn(
        { provider, model: embeddingModel, gotDims: embedding.length, expectedDims },
        'Embedding dimension mismatch — check EMBEDDING_DIMENSIONS env var matches pgvector schema'
      )
    }

    logger.debug(
      {
        provider,
        model: embeddingModel,
        inputLength: truncatedText.length,
        dimensions: embedding.length,
        duration,
      },
      'Embedding generated'
    )

    return embedding
  } catch (error) {
    logger.error(
      { err: error, provider, model: embeddingModel, inputLength: truncatedText.length },
      'Embedding generation failed'
    )
    throw error
  }
}

/**
 * Batch embed multiple texts.
 * More efficient than calling embed() in a loop for providers that support batching.
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors (same order as input)
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const provider = process.env.AI_PROVIDER || 'openai'
  const embeddingModel =
    process.env.EMBEDDING_MODEL || EMBEDDING_MODEL_DEFAULTS[provider] || 'text-embedding-3-large'

  const { client } = getAIClient()
  const truncatedTexts = texts.map((t) => t.slice(0, MAX_INPUT_LENGTH))
  const startTime = Date.now()

  try {
    const extraParams: Record<string, unknown> = {}
    if (provider === 'nvidia-nim') {
      extraParams.input_type = 'passage'
    }

    const response = await client.embeddings.create({
      model: embeddingModel,
      input: truncatedTexts,
      ...extraParams,
    })

    const duration = Date.now() - startTime

    logger.info(
      {
        provider,
        model: embeddingModel,
        batchSize: texts.length,
        duration,
      },
      'Batch embedding generated'
    )

    // Sort by index to maintain order
    return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
  } catch (error) {
    logger.error(
      { err: error, provider, model: embeddingModel, batchSize: texts.length },
      'Batch embedding failed'
    )
    throw error
  }
}

/**
 * Get the configured embedding dimensions.
 * Used for pgvector column definition and validation.
 */
export function getEmbeddingDimensions(): number {
  return parseInt(process.env.EMBEDDING_DIMENSIONS || '3072', 10)
}
