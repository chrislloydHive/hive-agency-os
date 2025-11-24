/**
 * OpenAI Client Configuration
 *
 * Exports a configured OpenAI client instance for use across the application.
 */

import OpenAI from 'openai';
import { env } from './env';

// Lazy initialization to avoid build-time errors when env vars aren't available
let _openai: OpenAI | null = null;

/**
 * Get OpenAI client (lazy initialization)
 */
export function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    _openai = new OpenAI({
      apiKey,
      timeout: 120000, // 120 seconds (2 minutes) for complex analyses
    });
  }
  return _openai;
}

/**
 * Configured OpenAI client (lazy initialized)
 * Uses OPENAI_API_KEY from environment
 * Includes 120s timeout for long-running completions
 */
export const openai = new Proxy({} as OpenAI, {
  get(target, prop) {
    const instance = getOpenAI();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
});

/**
 * Validate OpenAI API key is configured
 *
 * @throws Error if OPENAI_API_KEY is not set
 */
export function validateOpenAIKey(): void {
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
}
