// lib/os/plans/convert/workKeyGenerator.ts
// Deterministic work key generation for idempotency
//
// Ensures that re-running plan → work conversion doesn't create duplicates.
// Keys are stable across runs for the same plan content.

import crypto from 'crypto';

/**
 * Normalize a string for stable key generation.
 * Lowercase, trim, replace spaces with underscores, remove special chars.
 */
export function normalizeForKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 50); // Limit length for readability
}

/**
 * Generate a deterministic work key from plan metadata.
 * Format: {companyId}:{planId}:{sectionId}:{normalizedTitle}
 *
 * @param companyId - Company ID
 * @param planId - Plan ID
 * @param sectionId - Section identifier (e.g., "campaigns", "calendar")
 * @param itemTitle - Item title or identifier
 * @returns Stable work key string
 */
export function generateWorkKey(
  companyId: string,
  planId: string,
  sectionId: string,
  itemTitle: string
): string {
  const normalizedTitle = normalizeForKey(itemTitle);
  return `${companyId}:${planId}:${sectionId}:${normalizedTitle}`;
}

/**
 * Generate a work key hash for items that might have very long or complex titles.
 * Uses SHA-256 for stability.
 *
 * @param components - Array of strings to hash
 * @returns 16-character hex hash
 */
export function hashWorkKey(...components: string[]): string {
  const combined = components.join(':');
  return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 16);
}

/**
 * Generate work key for a media campaign
 */
export function generateCampaignWorkKey(
  companyId: string,
  planId: string,
  campaignId: string,
  campaignName: string
): string {
  return generateWorkKey(companyId, planId, 'campaign', `${campaignId}-${campaignName}`);
}

/**
 * Generate work key for a channel setup task
 */
export function generateChannelWorkKey(
  companyId: string,
  planId: string,
  channelId: string,
  channelName: string
): string {
  return generateWorkKey(companyId, planId, 'channel', `${channelId}-${channelName}`);
}

/**
 * Generate work key for a measurement/tracking task
 */
export function generateMeasurementWorkKey(
  companyId: string,
  planId: string,
  eventName: string
): string {
  return generateWorkKey(companyId, planId, 'measurement', eventName);
}

/**
 * Generate work key for a creative production task
 */
export function generateCreativeWorkKey(
  companyId: string,
  planId: string,
  campaignId: string,
  creativeType: string
): string {
  return generateWorkKey(companyId, planId, 'creative', `${campaignId}-${creativeType}`);
}

/**
 * Generate work key for a content calendar item
 */
export function generateCalendarWorkKey(
  companyId: string,
  planId: string,
  itemId: string,
  itemTitle: string
): string {
  return generateWorkKey(companyId, planId, 'calendar', `${itemId}-${itemTitle}`);
}

/**
 * Generate work key for an SEO task
 */
export function generateSEOWorkKey(
  companyId: string,
  planId: string,
  taskType: string,
  taskDetail: string
): string {
  return generateWorkKey(companyId, planId, 'seo', `${taskType}-${taskDetail}`);
}

/**
 * Generate work key for a distribution task
 */
export function generateDistributionWorkKey(
  companyId: string,
  planId: string,
  channelId: string,
  channelName: string
): string {
  return generateWorkKey(companyId, planId, 'distribution', `${channelId}-${channelName}`);
}
