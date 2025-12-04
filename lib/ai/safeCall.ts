// lib/ai/safeCall.ts
// Safe wrapper for AI calls with retry logic and error handling

/**
 * Result type for safe AI calls
 */
export interface SafeAiResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
  retryCount?: number;
}

/**
 * Options for safe AI calls
 */
export interface SafeAiOptions {
  /** Number of retry attempts (default: 1) */
  retries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Context for error logging */
  context?: string;
}

/**
 * Safely execute an AI call with automatic retries and error handling
 *
 * @param fn - The async function to execute
 * @param opts - Options for retries and logging
 * @returns SafeAiResult with ok status and value or error
 *
 * @example
 * const result = await safeAiCall(
 *   () => anthropic.messages.create({ ... }),
 *   { retries: 2, context: 'persona-generation' }
 * );
 *
 * if (result.ok) {
 *   // Use result.value
 * } else {
 *   // Handle error, show fallback UI
 *   console.error(result.error);
 * }
 */
export async function safeAiCall<T>(
  fn: () => Promise<T>,
  opts?: SafeAiOptions
): Promise<SafeAiResult<T>> {
  const retries = opts?.retries ?? 1;
  const retryDelay = opts?.retryDelay ?? 1000;
  const context = opts?.context ?? 'ai-call';

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const value = await fn();
      return {
        ok: true,
        value,
        retryCount: attempt,
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Log the error
      console.warn(
        `[SafeAI] ${context} failed (attempt ${attempt + 1}/${retries + 1}):`,
        lastError.message
      );

      // Check if this is a rate limit error - if so, wait longer
      const isRateLimit =
        lastError.message.includes('rate_limit') ||
        lastError.message.includes('429') ||
        lastError.message.includes('too many requests');

      // Don't retry if it's a bad request (400) or auth error (401/403)
      const isBadRequest =
        lastError.message.includes('400') ||
        lastError.message.includes('invalid') ||
        lastError.message.includes('401') ||
        lastError.message.includes('403');

      if (isBadRequest) {
        // Don't retry bad requests
        break;
      }

      // If we have more retries, wait before trying again
      if (attempt < retries) {
        const delay = isRateLimit ? retryDelay * 3 : retryDelay;
        await sleep(delay);
      }
    }
  }

  return {
    ok: false,
    error: lastError?.message ?? 'Unknown AI error',
    retryCount: retries,
  };
}

/**
 * Helper to sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract text content from an Anthropic message response
 */
export function extractTextFromMessage(message: {
  content: Array<{ type: string; text?: string }>;
}): string {
  const textBlock = message.content.find((block) => block.type === 'text');
  return textBlock?.text ?? '';
}

/**
 * Parse JSON from AI response text, with fallback
 */
export function parseJsonFromAi<T>(
  text: string,
  fallback: T
): { ok: boolean; value: T; error?: string } {
  try {
    // Try to find JSON in the response (may be wrapped in markdown code blocks)
    let jsonStr = text;

    // Remove markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as T;
    return { ok: true, value: parsed };
  } catch (err) {
    console.warn('[SafeAI] Failed to parse JSON from AI response:', err);
    return {
      ok: false,
      value: fallback,
      error: err instanceof Error ? err.message : 'JSON parse error',
    };
  }
}
