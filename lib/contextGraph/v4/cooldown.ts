// lib/contextGraph/v4/cooldown.ts
// Context V4: Proposal Cooldown Management
//
// Manages per-company cooldowns for proposal generation to prevent
// rapid re-generation and ensure rate limiting.

// In-memory cooldown store (upgrade to Redis for multi-instance)
// Key: companyId, Value: { expiresAt: timestamp, generatedAt: timestamp }
interface CooldownEntry {
  expiresAt: number;
  generatedAt: number;
}

const cooldownStore = new Map<string, CooldownEntry>();

// Default cooldown period in seconds
export const DEFAULT_COOLDOWN_SECONDS = 45;

// Minimum cooldown (can be overridden)
const MIN_COOLDOWN_SECONDS = 30;
const MAX_COOLDOWN_SECONDS = 120;

/**
 * Check if a company is currently in cooldown
 * @returns null if not in cooldown, otherwise remaining seconds
 */
export function getCooldownRemaining(companyId: string): number | null {
  const entry = cooldownStore.get(companyId);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now >= entry.expiresAt) {
    // Cooldown expired, clean up
    cooldownStore.delete(companyId);
    return null;
  }

  return Math.ceil((entry.expiresAt - now) / 1000);
}

/**
 * Check if company is in cooldown
 */
export function isInCooldown(companyId: string): boolean {
  return getCooldownRemaining(companyId) !== null;
}

/**
 * Set cooldown for a company after proposal generation
 * @param cooldownSeconds - Cooldown duration (default 45s)
 * @returns The cooldown entry with expiresAt timestamp
 */
export function setCooldown(
  companyId: string,
  cooldownSeconds: number = DEFAULT_COOLDOWN_SECONDS
): CooldownEntry {
  // Clamp to valid range
  const duration = Math.min(MAX_COOLDOWN_SECONDS, Math.max(MIN_COOLDOWN_SECONDS, cooldownSeconds));
  const now = Date.now();
  const entry: CooldownEntry = {
    expiresAt: now + duration * 1000,
    generatedAt: now,
  };
  cooldownStore.set(companyId, entry);
  return entry;
}

/**
 * Clear cooldown for a company (e.g., for testing or admin override)
 */
export function clearCooldown(companyId: string): void {
  cooldownStore.delete(companyId);
}

/**
 * Get cooldown info for a company
 * @returns Cooldown info or null if not in cooldown
 */
export function getCooldownInfo(companyId: string): {
  inCooldown: boolean;
  remainingSeconds: number | null;
  generatedAt: string | null;
  expiresAt: string | null;
} {
  const remaining = getCooldownRemaining(companyId);
  const entry = cooldownStore.get(companyId);

  return {
    inCooldown: remaining !== null,
    remainingSeconds: remaining,
    generatedAt: entry ? new Date(entry.generatedAt).toISOString() : null,
    expiresAt: entry ? new Date(entry.expiresAt).toISOString() : null,
  };
}

/**
 * Cleanup expired cooldowns (call periodically)
 */
export function cleanupExpiredCooldowns(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [companyId, entry] of cooldownStore.entries()) {
    if (now >= entry.expiresAt) {
      cooldownStore.delete(companyId);
      cleaned++;
    }
  }
  return cleaned;
}

// Periodic cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupExpiredCooldowns();
  }, 5 * 60 * 1000);
}
