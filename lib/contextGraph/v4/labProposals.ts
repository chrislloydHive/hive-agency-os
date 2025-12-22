// lib/contextGraph/v4/labProposals.ts
// Evidence-Grounded Lab Proposals Generator
//
// Creates decision-grade proposals from Lab results (BrandLab, WebsiteLab)
// with evidence anchors extracted from site snapshots.
//
// DOCTRINE: AI Proposes, Humans Decide
// Lab-generated proposals go through the Review Queue with evidence grounding.

import type { EvidenceAnchor } from '@/lib/types/contextField';
import type { SiteSnapshot } from './siteSnapshot';
import { getSiteSnapshotForCompany, extractEvidenceAnchors, shouldBlockProposals, hasUsableContent } from './siteSnapshot';
import { groundCandidate, isTooGeneric, type GroundedCandidate } from './evidenceGrounding';
import { createProposalBatch, saveProposalBatch } from '../nodes/proposalStorage';
import type { ContextProposalBatch } from '../nodes/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Lab result structure for proposal generation
 */
export interface LabResultForProposals {
  /** Lab type */
  labType: 'brandLab' | 'websiteLab';
  /** Lab run ID for provenance */
  runId?: string;
  /** Lab status */
  status?: 'success' | 'error' | 'blocked';
  /** Error message if failed */
  errorMessage?: string;
  /** Extracted fields with values */
  fields: Array<{
    fieldPath: string;
    fieldLabel: string;
    value: string;
    reasoning: string;
    confidence: number;
  }>;
  /** Raw site content for evidence extraction (WebsiteLab) */
  siteGraph?: {
    pages?: Array<{
      url?: string;
      path?: string;
      evidenceV3?: {
        title?: string;
        rawText?: string;
        heroText?: string;
        headlines?: string[];
        bodySnippets?: string[];
      };
    }>;
  };
  /** Site content from BrandLab */
  siteContent?: {
    url?: string;
    title?: string;
    heroText?: string;
    headlines?: string[];
    bodySnippets?: string[];
  };
}

/**
 * Options for generating lab proposals
 */
export interface GenerateLabProposalsOptions {
  /** Company ID */
  companyId: string;
  /** Company URL for snapshot */
  companyUrl: string;
  /** Company name for specificity checks */
  companyName?: string;
  /** Block proposals if lab had errors */
  blockOnError?: boolean;
  /** Maximum evidence anchors per proposal */
  maxAnchors?: number;
  /** Save proposals to storage */
  saveToStorage?: boolean;
}

/**
 * Result of generating lab proposals
 */
export interface GenerateLabProposalsResult {
  success: boolean;
  batch: ContextProposalBatch | null;
  saved: boolean;
  /** Proposals that were blocked due to error state */
  blocked: boolean;
  blockReason?: string;
  /** Summary of evidence grounding */
  evidenceSummary: {
    totalProposals: number;
    groundedCount: number;
    ungroundedCount: number;
    validationFailedCount: number;
  };
}

// ============================================================================
// BrandLab Proposal Mapping
// ============================================================================

/**
 * Field paths that BrandLab can propose
 */
const BRANDLAB_FIELD_MAPPINGS: Record<string, string> = {
  // Core positioning fields
  'positioning': 'brand.positioning',
  'positioningSummary': 'brand.positioning',
  'valueProposition': 'productOffer.valueProposition',
  'valueProp': 'productOffer.valueProposition',
  'primaryAudience': 'audience.primaryAudience',
  'icpDescription': 'audience.icpDescription',
  'icp': 'audience.icpDescription',
  // Brand fields
  'differentiators': 'brand.differentiators',
  'toneOfVoice': 'brand.toneOfVoice',
  'voiceTone': 'brand.toneOfVoice',
  'tagline': 'brand.tagline',
  'brandStrengths': 'brand.brandStrengths',
  'strengths': 'brand.brandStrengths',
  'brandWeaknesses': 'brand.brandWeaknesses',
  'weaknesses': 'brand.brandWeaknesses',
  'messagingPillars': 'brand.messagingPillars',
  'competitivePosition': 'brand.competitivePosition',
  'visualIdentity': 'brand.visualIdentitySummary',
  'brandPerception': 'brand.brandPerception',
  'brandPersonality': 'brand.brandPersonality',
};

/**
 * Field labels for BrandLab proposals
 */
const BRANDLAB_FIELD_LABELS: Record<string, string> = {
  'brand.positioning': 'Brand Positioning',
  'productOffer.valueProposition': 'Value Proposition',
  'audience.primaryAudience': 'Primary Audience',
  'audience.icpDescription': 'ICP Description',
  'brand.differentiators': 'Differentiators',
  'brand.toneOfVoice': 'Tone of Voice',
  'brand.tagline': 'Tagline',
  'brand.brandStrengths': 'Brand Strengths',
  'brand.brandWeaknesses': 'Brand Weaknesses',
  'brand.messagingPillars': 'Messaging Pillars',
  'brand.competitivePosition': 'Competitive Position',
  'brand.visualIdentitySummary': 'Visual Identity',
  'brand.brandPerception': 'Brand Perception',
  'brand.brandPersonality': 'Brand Personality',
};

// ============================================================================
// WebsiteLab Proposal Mapping
// ============================================================================

/**
 * Field paths that WebsiteLab can propose
 */
const WEBSITELAB_FIELD_MAPPINGS: Record<string, string> = {
  // Website fields
  'websiteScore': 'website.websiteScore',
  'executiveSummary': 'website.executiveSummary',
  'conversionBlocks': 'website.conversionBlocks',
  'quickWins': 'website.quickWins',
  'recommendations': 'website.recommendations',
  'funnelHealthScore': 'website.funnelHealthScore',
  // Brand from website
  'valuePropositionStrength': 'brand.valuePropositionScore',
  'toneAnalysis': 'brand.toneOfVoice',
  'brandColors': 'brand.brandColors',
  'trustScore': 'brand.trustScore',
  // Content
  'contentScore': 'content.contentScore',
  'contentSummary': 'content.contentSummary',
  'primaryCta': 'content.primaryCta',
};

/**
 * Field labels for WebsiteLab proposals
 */
const WEBSITELAB_FIELD_LABELS: Record<string, string> = {
  'website.websiteScore': 'Website Score',
  'website.executiveSummary': 'Executive Summary',
  'website.conversionBlocks': 'Conversion Blocks',
  'website.quickWins': 'Quick Wins',
  'website.recommendations': 'Recommendations',
  'website.funnelHealthScore': 'Funnel Health Score',
  'brand.valuePropositionScore': 'Value Proposition Score',
  'brand.toneOfVoice': 'Tone of Voice',
  'brand.brandColors': 'Brand Colors',
  'brand.trustScore': 'Trust Score',
  'content.contentScore': 'Content Score',
  'content.contentSummary': 'Content Summary',
  'content.primaryCta': 'Primary CTA',
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate evidence-grounded proposals from lab results
 *
 * @param labResult - Lab result data
 * @param options - Generation options
 * @returns Generated proposals with evidence grounding
 */
export async function generateLabProposals(
  labResult: LabResultForProposals,
  options: GenerateLabProposalsOptions
): Promise<GenerateLabProposalsResult> {
  const {
    companyId,
    companyUrl,
    companyName,
    blockOnError = true,
    maxAnchors = 3,
    saveToStorage = true,
  } = options;

  // Build site snapshot from lab data
  const snapshot = getSiteSnapshotForCompany(
    companyUrl,
    labResult.labType === 'websiteLab' ? {
      status: labResult.status,
      errorMessage: labResult.errorMessage,
      siteGraph: labResult.siteGraph,
    } : null,
    labResult.labType === 'brandLab' ? {
      status: labResult.status,
      errorMessage: labResult.errorMessage,
      siteContent: labResult.siteContent,
    } : null
  );

  // Check for error state blocking
  if (blockOnError && shouldBlockProposals(snapshot)) {
    return {
      success: false,
      batch: null,
      saved: false,
      blocked: true,
      blockReason: snapshot.errorMessage || 'Diagnostic failed - cannot ground proposals',
      evidenceSummary: {
        totalProposals: 0,
        groundedCount: 0,
        ungroundedCount: 0,
        validationFailedCount: 0,
      },
    };
  }

  // Ground each field with evidence
  const groundedCandidates: GroundedCandidate[] = [];

  for (const field of labResult.fields) {
    const grounded = groundCandidate(
      field.fieldPath,
      field.fieldLabel,
      field.value,
      field.reasoning,
      field.confidence,
      { snapshot, companyName, maxAnchors }
    );
    groundedCandidates.push(grounded);
  }

  // Build evidence summary
  const groundedCount = groundedCandidates.filter(c => c.evidenceAnchors.length > 0).length;
  const ungroundedCount = groundedCandidates.filter(c => c.evidenceAnchors.length === 0).length;
  const validationFailedCount = groundedCandidates.filter(c => !c.validationPassed).length;

  // Create proposal batch with evidence
  const batch = createProposalBatch(
    companyId,
    groundedCandidates.map(c => ({
      fieldPath: c.fieldPath,
      fieldLabel: c.fieldLabel,
      proposedValue: c.proposedValue,
      currentValue: null,
      reasoning: buildReasoningWithValidation(c),
      confidence: c.confidence,
      evidenceAnchors: c.evidenceAnchors,
    })),
    'lab_inference',
    `Evidence-grounded proposals from ${labResult.labType}`,
    labResult.runId || labResult.labType,
    {
      companyName,
      blockOnError,
      diagnosticErrorState: snapshot.isErrorState,
      diagnosticErrorMessage: snapshot.errorMessage,
    }
  );

  // Save if requested
  let saved = false;
  if (saveToStorage && batch.proposals.length > 0) {
    try {
      const result = await saveProposalBatch(batch);
      saved = !!result;
    } catch (error) {
      console.warn('[labProposals] Failed to save proposal batch:', error);
    }
  }

  return {
    success: true,
    batch,
    saved,
    blocked: false,
    evidenceSummary: {
      totalProposals: groundedCandidates.length,
      groundedCount,
      ungroundedCount,
      validationFailedCount,
    },
  };
}

/**
 * Build reasoning string including validation status
 */
function buildReasoningWithValidation(candidate: GroundedCandidate): string {
  const parts: string[] = [candidate.reasoning];

  if (!candidate.validationPassed && candidate.validationErrors.length > 0) {
    parts.push(`[Validation issues: ${candidate.validationErrors.join('; ')}]`);
  }

  if (candidate.evidenceAnchors.length === 0) {
    parts.push('[No evidence found - proposal is ungrounded]');
  } else {
    parts.push(`[Grounded with ${candidate.evidenceAnchors.length} evidence anchor(s)]`);
  }

  return parts.join(' ');
}

// ============================================================================
// BrandLab Specific
// ============================================================================

/**
 * Extract proposal candidates from BrandLab result
 */
export function extractBrandLabCandidates(
  brandLabResult: Record<string, unknown>
): LabResultForProposals['fields'] {
  const fields: LabResultForProposals['fields'] = [];

  // Helper to add field if value is meaningful
  const addField = (
    sourceKey: string,
    value: unknown,
    confidence: number = 0.8,
    reasoning: string = 'Extracted from Brand Lab analysis'
  ) => {
    const fieldPath = BRANDLAB_FIELD_MAPPINGS[sourceKey];
    if (!fieldPath) return;

    // Handle different value types
    let stringValue: string;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      stringValue = value.join(', ');
    } else if (typeof value === 'string') {
      if (!value.trim()) return;
      stringValue = value;
    } else if (value && typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      return;
    }

    fields.push({
      fieldPath,
      fieldLabel: BRANDLAB_FIELD_LABELS[fieldPath] || sourceKey,
      value: stringValue,
      reasoning,
      confidence,
    });
  };

  // Extract from findings (V4 format)
  const findings = brandLabResult.findings as Record<string, unknown> | undefined;
  if (findings) {
    // Value Proposition
    const valueProp = findings.valueProp as { headline?: string; description?: string } | undefined;
    if (valueProp?.headline && valueProp?.description) {
      addField(
        'valueProposition',
        `${valueProp.headline} — ${valueProp.description}`,
        0.85,
        'Value proposition extracted from Brand Lab findings'
      );
    }

    // Positioning
    const positioning = findings.positioning as { statement?: string; summary?: string } | undefined;
    if (positioning?.statement) {
      addField('positioning', positioning.statement, 0.85, 'Positioning statement from Brand Lab');
    } else if (positioning?.summary) {
      addField('positioning', positioning.summary, 0.75, 'Positioning summary from Brand Lab');
    }

    // ICP
    const icp = findings.icp as { primaryAudience?: string; buyerRoles?: string[] } | undefined;
    if (icp?.primaryAudience) {
      addField('primaryAudience', icp.primaryAudience, 0.8, 'Primary audience from Brand Lab ICP analysis');
    }

    // Differentiators
    const differentiators = findings.differentiators as { bullets?: string[] } | undefined;
    if (differentiators?.bullets && differentiators.bullets.length > 0) {
      addField('differentiators', differentiators.bullets, 0.8, 'Differentiators from Brand Lab');
    }

    // Tone of voice
    const tone = findings.toneOfVoice as { descriptor?: string; enabled?: boolean } | undefined;
    if (tone?.enabled && tone?.descriptor) {
      addField('toneOfVoice', tone.descriptor, 0.75, 'Tone of voice from Brand Lab');
    }

    // Messaging pillars
    const messaging = findings.messaging as { pillars?: Array<{ title: string; support?: string }> } | undefined;
    if (messaging?.pillars && messaging.pillars.length > 0) {
      const pillarStrings = messaging.pillars.map(p => p.support ? `${p.title}: ${p.support}` : p.title);
      addField('messagingPillars', pillarStrings, 0.75, 'Messaging pillars from Brand Lab');
    }
  }

  // Extract from legacy format (direct fields)
  if (brandLabResult.positioning && !findings) {
    addField('positioning', brandLabResult.positioning, 0.75);
  }
  if (brandLabResult.differentiators) {
    addField('differentiators', brandLabResult.differentiators, 0.75);
  }
  if (brandLabResult.strengths) {
    addField('brandStrengths', brandLabResult.strengths, 0.7);
  }
  if (brandLabResult.weaknesses) {
    addField('brandWeaknesses', brandLabResult.weaknesses, 0.7);
  }
  if (brandLabResult.toneOfVoice) {
    addField('toneOfVoice', brandLabResult.toneOfVoice, 0.7);
  }
  if (brandLabResult.valueProps) {
    addField('valueProp', brandLabResult.valueProps, 0.75);
  }
  if (brandLabResult.competitivePosition) {
    addField('competitivePosition', brandLabResult.competitivePosition, 0.7);
  }

  // Brand perception from narrative
  if (brandLabResult.narrativeSummary) {
    addField('brandPerception', brandLabResult.narrativeSummary, 0.65, 'Brand perception from narrative summary');
  }

  return fields;
}

/**
 * Generate proposals from BrandLab result
 */
export async function generateBrandLabProposals(
  companyId: string,
  companyUrl: string,
  brandLabResult: Record<string, unknown>,
  options?: Partial<GenerateLabProposalsOptions>
): Promise<GenerateLabProposalsResult> {
  const fields = extractBrandLabCandidates(brandLabResult);

  return generateLabProposals(
    {
      labType: 'brandLab',
      runId: brandLabResult.runId as string | undefined,
      status: brandLabResult.status as 'success' | 'error' | undefined,
      errorMessage: brandLabResult.errorMessage as string | undefined,
      fields,
      siteContent: brandLabResult.siteContent as LabResultForProposals['siteContent'],
    },
    {
      companyId,
      companyUrl,
      ...options,
    }
  );
}

// ============================================================================
// WebsiteLab Specific
// ============================================================================

/**
 * Extract proposal candidates from WebsiteLab result
 */
export function extractWebsiteLabCandidates(
  websiteLabResult: Record<string, unknown>
): LabResultForProposals['fields'] {
  const fields: LabResultForProposals['fields'] = [];

  // Helper to add field
  const addField = (
    sourceKey: string,
    value: unknown,
    confidence: number = 0.8,
    reasoning: string = 'Extracted from Website Lab analysis'
  ) => {
    const fieldPath = WEBSITELAB_FIELD_MAPPINGS[sourceKey];
    if (!fieldPath) return;

    let stringValue: string;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      stringValue = value.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
    } else if (typeof value === 'string') {
      if (!value.trim()) return;
      stringValue = value;
    } else if (typeof value === 'number') {
      stringValue = String(value);
    } else if (value && typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      return;
    }

    fields.push({
      fieldPath,
      fieldLabel: WEBSITELAB_FIELD_LABELS[fieldPath] || sourceKey,
      value: stringValue,
      reasoning,
      confidence,
    });
  };

  // Site assessment
  const siteAssessment = websiteLabResult.siteAssessment as Record<string, unknown> | undefined;
  if (siteAssessment) {
    if (siteAssessment.score !== undefined) {
      addField('websiteScore', siteAssessment.score, 0.9, 'Website score from site assessment');
    }
    if (siteAssessment.executiveSummary) {
      addField('executiveSummary', siteAssessment.executiveSummary, 0.85, 'Executive summary from site assessment');
    }
    if (siteAssessment.keyIssues) {
      addField('conversionBlocks', siteAssessment.keyIssues, 0.8, 'Conversion blocks identified');
    }
    if (siteAssessment.quickWins) {
      addField('quickWins', siteAssessment.quickWins, 0.8, 'Quick wins from site assessment');
    }
    if (siteAssessment.funnelHealthScore !== undefined) {
      addField('funnelHealthScore', siteAssessment.funnelHealthScore, 0.85, 'Funnel health score');
    }
  }

  // Trust analysis
  const trustAnalysis = websiteLabResult.trustAnalysis as Record<string, unknown> | undefined;
  if (trustAnalysis?.trustScore !== undefined) {
    addField('trustScore', trustAnalysis.trustScore, 0.8, 'Trust score from trust analysis');
  }

  // Content intelligence
  const contentIntelligence = websiteLabResult.contentIntelligence as Record<string, unknown> | undefined;
  if (contentIntelligence) {
    if (contentIntelligence.summaryScore !== undefined) {
      addField('contentScore', contentIntelligence.summaryScore, 0.8, 'Content score from content intelligence');
    }
    if (contentIntelligence.narrative) {
      addField('contentSummary', contentIntelligence.narrative, 0.75, 'Content summary');
    }
  }

  // CTA intelligence
  const ctaIntelligence = websiteLabResult.ctaIntelligence as Record<string, unknown> | undefined;
  if (ctaIntelligence) {
    const patterns = ctaIntelligence.patterns as { primaryCta?: string } | undefined;
    if (patterns?.primaryCta) {
      addField('primaryCta', patterns.primaryCta, 0.8, 'Primary CTA from CTA intelligence');
    }
  }

  return fields;
}

/**
 * Generate proposals from WebsiteLab result
 */
export async function generateWebsiteLabProposals(
  companyId: string,
  companyUrl: string,
  websiteLabResult: Record<string, unknown>,
  options?: Partial<GenerateLabProposalsOptions>
): Promise<GenerateLabProposalsResult> {
  const fields = extractWebsiteLabCandidates(websiteLabResult);

  return generateLabProposals(
    {
      labType: 'websiteLab',
      runId: websiteLabResult.runId as string | undefined,
      status: websiteLabResult.status as 'success' | 'error' | 'blocked' | undefined,
      errorMessage: websiteLabResult.errorMessage as string | undefined,
      fields,
      siteGraph: websiteLabResult.siteGraph as LabResultForProposals['siteGraph'],
    },
    {
      companyId,
      companyUrl,
      ...options,
    }
  );
}

// ============================================================================
// Exports
// ============================================================================

export const _testing = {
  BRANDLAB_FIELD_MAPPINGS,
  BRANDLAB_FIELD_LABELS,
  WEBSITELAB_FIELD_MAPPINGS,
  WEBSITELAB_FIELD_LABELS,
  buildReasoningWithValidation,
};
