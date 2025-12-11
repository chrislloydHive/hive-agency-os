// lib/os/detection/computeConfidence.ts
// Confidence scoring engine for detection signals

import type {
  GBPSignal,
  SocialSignal,
  SchemaSignal,
  DiscoveryResult,
  SignalSource,
} from './types';

/**
 * Source quality weights
 */
const SOURCE_WEIGHTS: Record<string, number> = {
  'schema-sameAs': 1.0,
  'direct-link': 0.9,
  'meta-tag': 0.8,
  'api': 0.85,
  'pattern-match': 0.6,
  'search-result': 0.5,
  'inferred': 0.3,
};

/**
 * Compute weighted confidence from multiple sources
 */
export function computeSourceConfidence(sources: SignalSource[]): number {
  if (sources.length === 0) return 0;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const source of sources) {
    const weight = SOURCE_WEIGHTS[source.type] || 0.5;
    totalWeight += weight;
    weightedSum += source.confidence * weight;
  }

  // Base score
  let score = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Bonus for multiple corroborating sources
  if (sources.length >= 2) {
    score += 5;
  }
  if (sources.length >= 3) {
    score += 5;
  }

  // Bonus for diverse source types
  const sourceTypes = new Set(sources.map(s => s.type));
  if (sourceTypes.size >= 2) {
    score += 5;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Check for cross-source consistency
 */
export function checkConsistency(
  sources: SignalSource[]
): { consistent: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  // Extract all URLs
  const urls = sources
    .filter(s => s.url)
    .map(s => s.url!);

  // Check for conflicting URLs
  const uniqueUrls = new Set(urls);
  if (uniqueUrls.size > 1) {
    // URLs differ - check if they point to the same resource
    const normalized = urls.map(url => {
      try {
        const parsed = new URL(url);
        return parsed.hostname + parsed.pathname.replace(/\/$/, '');
      } catch {
        return url;
      }
    });

    const uniqueNormalized = new Set(normalized);
    if (uniqueNormalized.size > 1) {
      conflicts.push(`url-mismatch: Multiple different URLs found: ${[...uniqueNormalized].join(', ')}`);
    }
  }

  return {
    consistent: conflicts.length === 0,
    conflicts,
  };
}

/**
 * Compute GBP signal confidence
 */
export function computeGBPConfidence(signal: GBPSignal): number {
  if (!signal.found) return 0;

  let score = computeSourceConfidence(signal.sources);

  // Bonus for having a valid URL
  if (signal.url) {
    score += 10;
  }

  // Bonus for having place ID
  if (signal.placeId) {
    score += 5;
  }

  // Penalty for failures
  const criticalFailures = signal.failureReasons.filter(f =>
    f.includes('error') || f.includes('conflict')
  );
  score -= criticalFailures.length * 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Compute social signal confidence
 */
export function computeSocialConfidence(signal: SocialSignal): number {
  if (!signal.url) return 0;

  let score = computeSourceConfidence(signal.sources);

  // Bonus for having extracted username
  if (signal.username) {
    score += 5;
  }

  // Penalty for failures
  const criticalFailures = signal.failureReasons.filter(f =>
    f.includes('error') || f.includes('mismatch')
  );
  score -= criticalFailures.length * 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Compute schema confidence based on completeness and validity
 */
export function computeSchemaConfidence(signals: SchemaSignal[]): number {
  if (signals.length === 0) return 0;

  let score = 30; // Base for having any schema

  // Bonus for Organization/LocalBusiness
  if (signals.some(s => s.type.toLowerCase().includes('organization') ||
                        s.type.toLowerCase().includes('localbusiness'))) {
    score += 20;
  }

  // Bonus for Website schema
  if (signals.some(s => s.type.toLowerCase().includes('website'))) {
    score += 10;
  }

  // Bonus for sameAs data
  const totalSameAs = signals.reduce((sum, s) => sum + s.sameAs.length, 0);
  if (totalSameAs > 0) {
    score += Math.min(20, totalSameAs * 5);
  }

  // Bonus for having name
  if (signals.some(s => s.name)) {
    score += 10;
  }

  return Math.min(100, score);
}

/**
 * Compute discovery confidence
 */
export function computeDiscoveryConfidence(result: DiscoveryResult): number {
  // Start with the result's own confidence
  let score = result.confidence;

  // Adjust based on success rate
  const successCount = result.discoveredPages.filter(p => p.status === 200).length;
  const totalPages = result.discoveredPages.length;

  if (totalPages > 0) {
    const successRate = successCount / totalPages;
    score = score * 0.7 + successRate * 100 * 0.3;
  }

  // Penalty for errors
  score -= result.errors.length * 5;

  // Bonus for good depth coverage
  if (result.maxDepthReached >= 2) {
    score += 5;
  }

  // Penalty for too few pages
  if (result.discoveredPages.length < 5) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Compute global confidence score for all detection results
 */
export function computeGlobalConfidence(params: {
  gbp: GBPSignal;
  socials: SocialSignal[];
  schema: SchemaSignal[];
  discovery: DiscoveryResult;
}): number {
  const { gbp, socials, schema, discovery } = params;

  // Component scores
  const gbpScore = computeGBPConfidence(gbp);
  const schemaScore = computeSchemaConfidence(schema);
  const discoveryScore = computeDiscoveryConfidence(discovery);

  // Average social scores
  const socialScores = socials
    .filter(s => s.url)
    .map(s => computeSocialConfidence(s));
  const avgSocialScore = socialScores.length > 0
    ? socialScores.reduce((a, b) => a + b, 0) / socialScores.length
    : 0;

  // Weighted combination
  const weights = {
    schema: 0.25,
    discovery: 0.25,
    social: 0.25,
    gbp: 0.25,
  };

  const weightedScore =
    schemaScore * weights.schema +
    discoveryScore * weights.discovery +
    avgSocialScore * weights.social +
    gbpScore * weights.gbp;

  // Adjustments
  let finalScore = weightedScore;

  // Bonus for having multiple signal types
  const signalTypesPresent = [
    gbp.found,
    socials.some(s => s.url),
    schema.length > 0,
    discovery.discoveredPages.length > 0,
  ].filter(Boolean).length;

  if (signalTypesPresent >= 3) {
    finalScore += 10;
  }

  // Penalty for critical missing elements
  if (!gbp.found && !schema.some(s => s.type.toLowerCase().includes('localbusiness'))) {
    finalScore -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(finalScore)));
}

/**
 * Get confidence level label
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'very-low' {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'very-low';
}

/**
 * Get confidence explanation
 */
export function explainConfidence(score: number, sources: SignalSource[]): string {
  const level = getConfidenceLevel(score);
  const sourceCount = sources.length;
  const sourceTypes = new Set(sources.map(s => s.type));

  const parts: string[] = [];

  switch (level) {
    case 'high':
      parts.push('High confidence');
      break;
    case 'medium':
      parts.push('Moderate confidence');
      break;
    case 'low':
      parts.push('Low confidence');
      break;
    case 'very-low':
      parts.push('Very low confidence');
      break;
  }

  if (sourceCount === 0) {
    parts.push('no sources found');
  } else if (sourceCount === 1) {
    parts.push(`based on ${sourceCount} source (${[...sourceTypes].join(', ')})`);
  } else {
    parts.push(`based on ${sourceCount} sources (${[...sourceTypes].join(', ')})`);
  }

  return parts.join(' - ');
}
