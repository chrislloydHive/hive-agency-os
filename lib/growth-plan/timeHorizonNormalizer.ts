/**
 * Normalize time horizon values from LLM responses
 * 
 * Accepts common variants that the model might emit and normalizes them
 * to the canonical format: 'immediate' | 'short_term' | 'medium_term' | 'long_term'
 */

export type TimeHorizon = 'immediate' | 'short_term' | 'medium_term' | 'long_term';

/**
 * Normalize a raw time horizon string to the canonical format
 * 
 * @param raw - Raw time horizon string from LLM (e.g., "short-term", "short_term", "short", etc.)
 * @returns Normalized time horizon
 */
export function normalizeTimeHorizon(raw: string | undefined | null): TimeHorizon {
  if (!raw || typeof raw !== 'string') {
    // Default to short_term instead of immediate, so we don't overload the first column
    return 'short_term';
  }

  // Normalize: lowercase, remove spaces, hyphens, underscores
  const normalized = raw.toLowerCase().replace(/\s+/g, '').replace(/-/g, '').replace(/_/g, '');

  // Map common variants to canonical values
  if (['now', 'immediate', 'immediately', 'asap'].includes(normalized)) {
    return 'immediate';
  }
  
  if (['short', 'shortterm', 'next', 'soon'].includes(normalized)) {
    return 'short_term';
  }
  
  if (['medium', 'mediumterm', 'midterm', 'mid', 'midterm'].includes(normalized)) {
    return 'medium_term';
  }
  
  if (['long', 'longterm', 'later', 'future'].includes(normalized)) {
    return 'long_term';
  }

  // If it already matches canonical format, return as-is
  if (['immediate', 'short_term', 'medium_term', 'long_term'].includes(normalized)) {
    return normalized as TimeHorizon;
  }

  // Default to short_term instead of immediate, so we don't overload the first column
  console.warn(`⚠️  Unknown timeHorizon value "${raw}", defaulting to short_term`);
  return 'short_term';
}

