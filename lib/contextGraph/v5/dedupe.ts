// lib/contextGraph/v5/dedupe.ts
// V5 Website Lab deduplication logic for Context Graph proposals
//
// Match on: page path + problem/failure reason + domain=Website
// If similarity ≥ 80% → attach as evidence, not new node

import type { V5ContextProposal, DedupeMatchResult } from './types';

// ============================================================================
// SIMILARITY THRESHOLDS
// ============================================================================

/**
 * Minimum similarity score to consider a match
 */
export const SIMILARITY_THRESHOLD = 0.8; // 80%

/**
 * Weights for similarity calculation
 */
const WEIGHTS = {
  pagePath: 0.4,      // 40% weight for page path match
  problem: 0.4,       // 40% weight for problem text similarity
  personas: 0.2,      // 20% weight for persona overlap
} as const;

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Check if a new proposal matches an existing node
 */
export function checkForDuplicate(
  newProposal: V5ContextProposal,
  existingNodes: V5ContextProposal[]
): DedupeMatchResult {
  // Filter to same domain (Website)
  const websiteNodes = existingNodes.filter((n) => n.domain === 'Website');

  let bestMatch: { node: V5ContextProposal; similarity: number } | null = null;

  for (const existing of websiteNodes) {
    const similarity = calculateSimilarity(newProposal, existing);

    if (similarity >= SIMILARITY_THRESHOLD) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { node: existing, similarity };
      }
    }
  }

  if (bestMatch) {
    return {
      isMatch: true,
      similarity: bestMatch.similarity,
      existingNodeId: bestMatch.node.id,
      action: 'attach_evidence',
    };
  }

  return {
    isMatch: false,
    similarity: 0,
    action: 'create_new',
  };
}

/**
 * Calculate similarity between two proposals
 */
export function calculateSimilarity(
  a: V5ContextProposal,
  b: V5ContextProposal
): number {
  // Page path similarity (exact match or same page)
  const pagePathScore = calculatePagePathSimilarity(a.pagePath, b.pagePath);

  // Problem text similarity (Jaccard on words)
  const problemScore = calculateTextSimilarity(a.problem, b.problem);

  // Persona overlap (Jaccard on personas)
  const personaScore = calculatePersonaOverlap(a.personasAffected, b.personasAffected);

  // Weighted average
  return (
    WEIGHTS.pagePath * pagePathScore +
    WEIGHTS.problem * problemScore +
    WEIGHTS.personas * personaScore
  );
}

/**
 * Calculate page path similarity
 */
function calculatePagePathSimilarity(a: string, b: string): number {
  // Exact match
  if (a === b) return 1.0;

  // Normalize paths
  const normA = normalizePath(a);
  const normB = normalizePath(b);

  if (normA === normB) return 1.0;

  // Partial match (same parent path)
  const partsA = normA.split('/').filter(Boolean);
  const partsB = normB.split('/').filter(Boolean);

  if (partsA.length === 0 || partsB.length === 0) return 0;

  // Check if one is a parent of the other
  const minLen = Math.min(partsA.length, partsB.length);
  let matchingParts = 0;

  for (let i = 0; i < minLen; i++) {
    if (partsA[i] === partsB[i]) {
      matchingParts++;
    } else {
      break;
    }
  }

  return matchingParts / Math.max(partsA.length, partsB.length);
}

/**
 * Calculate text similarity using Jaccard index on words
 */
function calculateTextSimilarity(a: string, b: string): number {
  const wordsA = extractWords(a);
  const wordsB = extractWords(b);

  if (wordsA.size === 0 && wordsB.size === 0) return 1.0;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  // Jaccard index: intersection / union
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Calculate persona overlap using Jaccard index
 */
function calculatePersonaOverlap(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0;

  const intersection = new Set([...setA].filter((p) => setB.has(p)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize a URL path for comparison
 */
function normalizePath(path: string): string {
  return path
    .toLowerCase()
    .trim()
    .replace(/\/+$/, '') // Remove trailing slashes
    .replace(/\/+/g, '/') // Collapse multiple slashes
    || '/';
}

/**
 * Extract significant words from text
 */
function extractWords(text: string): Set<string> {
  // Remove common stop words and normalize
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'between', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
    'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
    'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
    'this', 'that', 'these', 'those', 'it', 'its',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return new Set(words);
}

// ============================================================================
// BATCH DEDUPLICATION
// ============================================================================

/**
 * Deduplicate a batch of proposals against existing nodes
 */
export function deduplicateBatch(
  newProposals: V5ContextProposal[],
  existingNodes: V5ContextProposal[]
): {
  toCreate: V5ContextProposal[];
  toAttachEvidence: Array<{ proposal: V5ContextProposal; existingNodeId: string }>;
  skipped: V5ContextProposal[];
} {
  const toCreate: V5ContextProposal[] = [];
  const toAttachEvidence: Array<{ proposal: V5ContextProposal; existingNodeId: string }> = [];
  const skipped: V5ContextProposal[] = [];

  // Track proposals we've already decided to create (for intra-batch deduping)
  const pendingCreates: V5ContextProposal[] = [];

  for (const proposal of newProposals) {
    // Check against existing nodes
    const existingMatch = checkForDuplicate(proposal, existingNodes);

    if (existingMatch.isMatch && existingMatch.existingNodeId) {
      toAttachEvidence.push({
        proposal,
        existingNodeId: existingMatch.existingNodeId,
      });
      continue;
    }

    // Check against pending creates (intra-batch deduping)
    const pendingMatch = checkForDuplicate(proposal, pendingCreates);

    if (pendingMatch.isMatch) {
      skipped.push(proposal);
      continue;
    }

    // No match - create new
    toCreate.push(proposal);
    pendingCreates.push(proposal);
  }

  return { toCreate, toAttachEvidence, skipped };
}

/**
 * Merge evidence from a new proposal into an existing node
 * Returns the updated node with additional provenance
 */
export function mergeEvidence(
  existingNode: V5ContextProposal,
  newProposal: V5ContextProposal
): V5ContextProposal {
  // Add new run to provenance (would need array tracking in real impl)
  // For now, just update the timestamp if newer
  const existingDate = new Date(existingNode.createdAt);
  const newDate = new Date(newProposal.createdAt);

  // Keep the existing node but potentially boost confidence
  const boostedConfidence = Math.min(
    existingNode.provenance.confidence + 0.05, // +5% per additional evidence
    0.95 // Cap at 95%
  );

  return {
    ...existingNode,
    provenance: {
      ...existingNode.provenance,
      confidence: boostedConfidence,
      // In a real implementation, we'd track multiple runIds
    },
  };
}
