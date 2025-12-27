// lib/os/artifacts/convert/workKeyGenerator.ts
// Deterministic work key generation for artifact → work conversion
//
// Ensures that re-running artifact → work conversion doesn't create duplicates.
// Keys are stable across runs for the same artifact content.

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
 * Generate a deterministic work key from artifact metadata.
 * Format: {companyId}:{artifactId}:{sectionId?}:{normalizedTitle}
 *
 * @param companyId - Company ID
 * @param artifactId - Artifact ID
 * @param sectionId - Optional section identifier
 * @param itemTitle - Item title or identifier
 * @returns Stable work key string
 */
export function generateArtifactWorkKey(
  companyId: string,
  artifactId: string,
  sectionId: string | undefined,
  itemTitle: string
): string {
  const normalizedTitle = normalizeForKey(itemTitle);
  const parts = [companyId, artifactId];
  if (sectionId) {
    parts.push(sectionId);
  }
  parts.push(normalizedTitle);
  return parts.join(':');
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
 * Generate work key for a structured section work item
 */
export function generateSectionWorkKey(
  companyId: string,
  artifactId: string,
  sectionId: string,
  itemIndex: number
): string {
  return generateArtifactWorkKey(companyId, artifactId, sectionId, `item_${itemIndex}`);
}

/**
 * Generate work key for a freeform/AI-derived work item
 */
export function generateFreeformWorkKey(
  companyId: string,
  artifactId: string,
  itemTitle: string,
  itemIndex: number
): string {
  // Use both title and index to ensure uniqueness
  const normalizedTitle = normalizeForKey(itemTitle);
  return `${companyId}:${artifactId}:freeform:${itemIndex}_${normalizedTitle}`;
}

/**
 * Generate an artifact version hash from content
 * Used for traceability when no formal version exists
 */
export function generateArtifactVersionHash(
  artifactId: string,
  generatedContent: unknown,
  updatedAt?: string
): string {
  const contentStr = typeof generatedContent === 'string'
    ? generatedContent
    : JSON.stringify(generatedContent || {});

  return hashWorkKey(artifactId, contentStr, updatedAt || '');
}
