// lib/gap/dataConfidence.ts
// Data Confidence calculation for GAP-IA reports
//
// Aligned with Ops Lab pattern: scores 0-100 with level buckets (low/medium/high)
// and human-readable reason explaining confidence factors.

import type { GapDataConfidence, GapDataConfidenceLevel, DigitalFootprintData } from './types';

// ============================================================================
// Types
// ============================================================================

export interface DataConfidenceInput {
  /** HTML signals extracted from the page */
  htmlSignals: {
    title?: string;
    h1s: string[];
    metaDescription?: string;
    hasNav: boolean;
    hasBlog: boolean;
    ctaCount: number;
    hasTestimonials: boolean;
    hasCaseStudies: boolean;
  };
  /** Digital footprint data */
  digitalFootprint: DigitalFootprintData;
  /** Number of pages analyzed */
  pagesAnalyzed: number;
  /** Business type detected */
  businessType?: string;
}

// ============================================================================
// Main Calculation Function
// ============================================================================

/**
 * Compute data confidence score for GAP-IA assessment
 *
 * Scoring breakdown:
 * - Base score: 30
 * - HTML signals quality: +0-25
 * - Digital footprint signals: +0-25
 * - Multi-page analysis: +0-10
 * - Business type detection: +0-10
 *
 * Issues are tracked to explain confidence score in the UI.
 */
export function computeGapDataConfidence(input: DataConfidenceInput): GapDataConfidence {
  let score = 30; // Base score
  const issues: string[] = [];
  const positives: string[] = [];

  // =========================================================================
  // HTML Signals Quality (+0-25)
  // =========================================================================

  // Title present (+5)
  if (input.htmlSignals.title && input.htmlSignals.title.length > 5) {
    score += 5;
    positives.push('Page title detected');
  } else {
    issues.push('No page title detected');
  }

  // H1 headings present (+5)
  if (input.htmlSignals.h1s.length > 0) {
    score += 5;
    positives.push('H1 headings detected');
  } else {
    issues.push('No H1 headings detected');
  }

  // Meta description present (+5)
  if (input.htmlSignals.metaDescription && input.htmlSignals.metaDescription.length > 20) {
    score += 5;
    positives.push('Meta description detected');
  } else {
    issues.push('No meta description detected');
  }

  // Navigation structure (+5)
  if (input.htmlSignals.hasNav) {
    score += 5;
    positives.push('Navigation structure detected');
  } else {
    issues.push('No navigation structure detected');
  }

  // CTAs detected (+5)
  if (input.htmlSignals.ctaCount >= 2) {
    score += 5;
    positives.push('Multiple CTAs detected');
  } else if (input.htmlSignals.ctaCount === 1) {
    score += 2;
    positives.push('CTA detected');
  } else {
    issues.push('No clear CTAs detected');
  }

  // =========================================================================
  // Digital Footprint Signals (+0-25)
  // =========================================================================

  // Google Business Profile (+10 for local businesses, +5 for others)
  const isLocalBusiness = input.businessType === 'local_business' ||
                          input.businessType === 'brick_and_mortar' ||
                          input.businessType === 'b2c_services';

  if (input.digitalFootprint.gbp.found) {
    score += isLocalBusiness ? 10 : 5;
    positives.push('Google Business Profile detected');
  } else if (isLocalBusiness) {
    issues.push('Google Business Profile not detected for local business');
  }

  // LinkedIn presence (+5)
  if (input.digitalFootprint.linkedin.found) {
    score += 5;
    positives.push('LinkedIn presence detected');
  }

  // Social media presence (+5 for 2+, +2 for 1)
  const socialCount = [
    input.digitalFootprint.otherSocials.instagram,
    input.digitalFootprint.otherSocials.facebook,
    input.digitalFootprint.otherSocials.youtube,
  ].filter(Boolean).length;

  if (socialCount >= 2) {
    score += 5;
    positives.push(`${socialCount} social media profiles detected`);
  } else if (socialCount === 1) {
    score += 2;
    positives.push('Social media presence detected');
  } else {
    issues.push('No social media profiles detected');
  }

  // Reviews detected (+5)
  if (input.digitalFootprint.gbp.hasReviews) {
    score += 5;
    positives.push('Reviews detected');
  }

  // =========================================================================
  // Multi-Page Analysis (+0-10)
  // =========================================================================

  if (input.pagesAnalyzed >= 5) {
    score += 10;
    positives.push(`${input.pagesAnalyzed} pages analyzed`);
  } else if (input.pagesAnalyzed >= 3) {
    score += 7;
    positives.push(`${input.pagesAnalyzed} pages analyzed`);
  } else if (input.pagesAnalyzed >= 2) {
    score += 4;
    issues.push('Limited pages analyzed (2)');
  } else {
    issues.push('Only homepage analyzed');
  }

  // =========================================================================
  // Business Type Detection (+0-10)
  // =========================================================================

  if (input.businessType && input.businessType !== 'other' && input.businessType !== 'unknown') {
    score += 10;
    positives.push('Business type identified');
  } else {
    score += 3;
    issues.push('Business type could not be determined');
  }

  // =========================================================================
  // Cap and Determine Level
  // =========================================================================

  score = Math.min(100, Math.max(0, score));

  let level: GapDataConfidenceLevel;
  if (score >= 70) {
    level = 'high';
  } else if (score >= 45) {
    level = 'medium';
  } else {
    level = 'low';
  }

  // Build human-readable reason
  const reason = buildConfidenceReason(level, positives, issues);

  return {
    score,
    level,
    reason,
    issues: issues.length > 0 ? issues : undefined,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildConfidenceReason(
  level: GapDataConfidenceLevel,
  positives: string[],
  issues: string[]
): string {
  if (level === 'high') {
    return `High confidence: ${positives.slice(0, 3).join(', ').toLowerCase()}.`;
  } else if (level === 'medium') {
    if (issues.length > 0) {
      return `Medium confidence. ${issues.slice(0, 2).join('; ')}.`;
    }
    return 'Medium confidence based on available signals.';
  } else {
    if (issues.length > 0) {
      return `Low confidence. ${issues.slice(0, 3).join('; ')}.`;
    }
    return 'Low confidence due to limited signals available.';
  }
}

/**
 * Get color class for data confidence level (for UI consistency with Ops Lab)
 */
export function getDataConfidenceColor(level: GapDataConfidenceLevel): string {
  const colors: Record<GapDataConfidenceLevel, string> = {
    low: 'text-amber-400',
    medium: 'text-cyan-400',
    high: 'text-emerald-400',
  };
  return colors[level] || 'text-slate-400';
}

/**
 * Get background color class for data confidence level
 */
export function getDataConfidenceBgColor(level: GapDataConfidenceLevel): string {
  const colors: Record<GapDataConfidenceLevel, string> = {
    low: 'bg-amber-500/10 border-amber-500/30',
    medium: 'bg-cyan-500/10 border-cyan-500/30',
    high: 'bg-emerald-500/10 border-emerald-500/30',
  };
  return colors[level] || 'bg-slate-500/10 border-slate-500/30';
}
