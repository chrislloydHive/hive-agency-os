// lib/contextGraph/v4/promotion/generateProposalsFromDiagnostics.ts
// Proposal Generation Pipeline for GAP/Labs → Context V4 Promotion
//
// Extracts candidates from diagnostic outputs and creates Context V4 proposals
// for human review. Uses deterministic heuristics - no LLM calls in MVP.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { getRunsGroupedByTool, type DiagnosticRun } from '@/lib/os/diagnostics/runs';
import { buildBrandLabCandidates } from '../brandLabCandidates';
import {
  PROMOTABLE_FIELDS,
  isPromotableField,
  getPromotableFieldLabel,
  type PromotionSourceType,
} from './promotableFields';
import type {
  ContextProposal,
  CreateContextProposalInput,
  GenerateProposalsResponse,
  ProposalEvidence,
} from '@/lib/types/contextProposal';

// ============================================================================
// Types
// ============================================================================

/**
 * A candidate extracted from a diagnostic run
 */
interface DiagnosticCandidate {
  fieldKey: string;
  value: string;
  confidence: number;
  sourceType: PromotionSourceType;
  sourceRunId: string;
  evidence: ProposalEvidence;
}

/**
 * Options for proposal generation
 */
interface GenerateProposalsOptions {
  /** Only generate for specific field keys */
  fieldKeys?: string[];
  /** Skip deduplication check (for testing) */
  skipDedup?: boolean;
  /** Dry run - don't actually create proposals */
  dryRun?: boolean;
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate Context V4 proposals from diagnostic outputs for a company.
 *
 * This is the main entry point for the promotion pipeline. It:
 * 1. Loads latest diagnostic outputs (GAP, Brand Lab, etc.)
 * 2. Extracts candidates using deterministic heuristics
 * 3. Dedupes against existing proposals
 * 4. Creates new proposals in the Context Proposals table
 *
 * @param companyId - Company ID to generate proposals for
 * @param options - Optional configuration
 * @returns Generation result with counts and proposal summaries
 */
export async function generateProposalsFromDiagnostics(
  companyId: string,
  options: GenerateProposalsOptions = {}
): Promise<GenerateProposalsResponse> {
  console.log('[ProposalGenerator] Starting generation for company:', companyId);

  const result: GenerateProposalsResponse = {
    success: false,
    createdCount: 0,
    skippedCount: 0,
    proposals: [],
    debug: {
      diagnosticsFound: [],
      candidatesExtracted: 0,
      deduplicationSkipped: 0,
    },
  };

  try {
    // 1. Load diagnostic runs grouped by tool
    const diagnosticsByTool = await getRunsGroupedByTool(companyId);

    // Check if any diagnostics exist
    const diagnosticsFound: string[] = [];
    for (const [toolId, runs] of Object.entries(diagnosticsByTool)) {
      const completedRuns = runs.filter(r => r.status === 'complete');
      if (completedRuns.length > 0) {
        diagnosticsFound.push(toolId);
      }
    }

    result.debug!.diagnosticsFound = diagnosticsFound;

    if (diagnosticsFound.length === 0) {
      result.error = 'No completed diagnostic runs found. Run labs first before generating proposals.';
      return result;
    }

    console.log('[ProposalGenerator] Found completed diagnostics:', diagnosticsFound);

    // 2. Extract candidates from each diagnostic type
    const allCandidates: DiagnosticCandidate[] = [];

    // Extract from Brand Lab
    const brandLabRuns = diagnosticsByTool.brandLab?.filter(r => r.status === 'complete') || [];
    if (brandLabRuns.length > 0) {
      const brandCandidates = extractBrandLabCandidates(brandLabRuns[0]);
      allCandidates.push(...brandCandidates);
      console.log('[ProposalGenerator] Extracted from Brand Lab:', brandCandidates.length);
    }

    // Extract from Website Lab
    const websiteLabRuns = diagnosticsByTool.websiteLab?.filter(r => r.status === 'complete') || [];
    if (websiteLabRuns.length > 0) {
      const websiteCandidates = extractWebsiteLabCandidates(websiteLabRuns[0]);
      allCandidates.push(...websiteCandidates);
      console.log('[ProposalGenerator] Extracted from Website Lab:', websiteCandidates.length);
    }

    // Extract from Full GAP
    const gapPlanRuns = diagnosticsByTool.gapPlan?.filter(r => r.status === 'complete') || [];
    if (gapPlanRuns.length > 0) {
      const gapCandidates = extractGapPlanCandidates(gapPlanRuns[0]);
      allCandidates.push(...gapCandidates);
      console.log('[ProposalGenerator] Extracted from GAP Plan:', gapCandidates.length);
    }

    // Extract from GAP IA
    const gapIaRuns = diagnosticsByTool.gapSnapshot?.filter(r => r.status === 'complete') || [];
    if (gapIaRuns.length > 0) {
      const gapIaCandidates = extractGapIaCandidates(gapIaRuns[0]);
      allCandidates.push(...gapIaCandidates);
      console.log('[ProposalGenerator] Extracted from GAP IA:', gapIaCandidates.length);
    }

    // Extract from Audience Lab
    const audienceLabRuns = diagnosticsByTool.audienceLab?.filter(r => r.status === 'complete') || [];
    if (audienceLabRuns.length > 0) {
      const audienceCandidates = extractAudienceLabCandidates(audienceLabRuns[0]);
      allCandidates.push(...audienceCandidates);
      console.log('[ProposalGenerator] Extracted from Audience Lab:', audienceCandidates.length);
    }

    // Extract from Competition Lab
    const competitionLabRuns = diagnosticsByTool.competitionLab?.filter(r => r.status === 'complete') || [];
    if (competitionLabRuns.length > 0) {
      const competitionCandidates = extractCompetitionLabCandidates(competitionLabRuns[0]);
      allCandidates.push(...competitionCandidates);
      console.log('[ProposalGenerator] Extracted from Competition Lab:', competitionCandidates.length);
    }

    result.debug!.candidatesExtracted = allCandidates.length;

    if (allCandidates.length === 0) {
      result.success = true;
      result.error = 'No candidates could be extracted from diagnostics. Labs may not contain relevant data.';
      return result;
    }

    // 3. Filter to only promotable fields
    const promotableCandidates = allCandidates.filter(c => {
      const isPromotable = isPromotableField(c.fieldKey);
      if (!isPromotable) {
        console.log('[ProposalGenerator] Skipping non-promotable field:', c.fieldKey);
      }
      return isPromotable;
    });

    // Apply field key filter if specified
    let filteredCandidates = promotableCandidates;
    if (options.fieldKeys && options.fieldKeys.length > 0) {
      filteredCandidates = promotableCandidates.filter(c =>
        options.fieldKeys!.includes(c.fieldKey)
      );
    }

    console.log('[ProposalGenerator] Promotable candidates:', filteredCandidates.length);

    // 4. Dedupe against existing proposals
    let candidatesToCreate = filteredCandidates;
    if (!options.skipDedup) {
      const existingProposals = await loadExistingProposals(companyId);
      candidatesToCreate = deduplicateCandidates(filteredCandidates, existingProposals);
      result.debug!.deduplicationSkipped = filteredCandidates.length - candidatesToCreate.length;
    }

    console.log('[ProposalGenerator] Candidates after dedup:', candidatesToCreate.length);

    if (candidatesToCreate.length === 0) {
      result.success = true;
      result.skippedCount = filteredCandidates.length;
      return result;
    }

    // 5. Create proposals in Airtable (unless dry run)
    if (options.dryRun) {
      result.success = true;
      result.createdCount = candidatesToCreate.length;
      result.proposals = candidatesToCreate.map(c => ({
        fieldKey: c.fieldKey,
        sourceType: c.sourceType,
        confidence: c.confidence,
        snippetPreview: c.value.slice(0, 100) + (c.value.length > 100 ? '...' : ''),
      }));
      return result;
    }

    const createdProposals = await createProposals(companyId, candidatesToCreate);
    result.success = true;
    result.createdCount = createdProposals.length;
    result.skippedCount = filteredCandidates.length - createdProposals.length;
    result.proposals = createdProposals.map(p => ({
      fieldKey: p.fieldKey,
      sourceType: p.sourceType,
      confidence: p.confidence,
      snippetPreview: p.proposedValue.slice(0, 100) + (p.proposedValue.length > 100 ? '...' : ''),
    }));

    console.log('[ProposalGenerator] Generation complete:', {
      created: result.createdCount,
      skipped: result.skippedCount,
    });

    return result;
  } catch (error) {
    console.error('[ProposalGenerator] Generation failed:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
    return result;
  }
}

// ============================================================================
// Candidate Extractors
// ============================================================================

/**
 * Extract candidates from Brand Lab results
 */
function extractBrandLabCandidates(run: DiagnosticRun): DiagnosticCandidate[] {
  const candidates: DiagnosticCandidate[] = [];

  if (!run.rawJson) {
    console.log('[ProposalGenerator] Brand Lab run has no rawJson');
    return candidates;
  }

  // Use the existing Brand Lab candidate builder
  const buildResult = buildBrandLabCandidates(run.rawJson);

  for (const candidate of buildResult.candidates) {
    // Map Brand Lab field keys to our promotable fields
    const fieldMapping: Record<string, string> = {
      'brand.positioning': 'brand.positioning',
      'productOffer.valueProposition': 'productOffer.valueProposition',
      'audience.primaryAudience': 'audience.icpDescription',
      'audience.icpDescription': 'audience.icpDescription',
    };

    const mappedKey = fieldMapping[candidate.key] || candidate.key;

    candidates.push({
      fieldKey: mappedKey,
      value: String(candidate.value),
      confidence: Math.round((candidate.confidence || 0.7) * 100),
      sourceType: 'brand_lab',
      sourceRunId: run.id,
      evidence: {
        source: 'Brand Lab',
        runId: run.id,
        snippets: [candidate.evidence?.snippet || ''].filter(Boolean),
        urls: [],
      },
    });
  }

  return candidates;
}

/**
 * Extract candidates from Website Lab results
 */
function extractWebsiteLabCandidates(run: DiagnosticRun): DiagnosticCandidate[] {
  const candidates: DiagnosticCandidate[] = [];

  if (!run.rawJson) {
    console.log('[ProposalGenerator] Website Lab run has no rawJson');
    return candidates;
  }

  const raw = run.rawJson as any;

  // Try to find business model from various paths
  const siteAssessment = raw.siteAssessment || raw.rawEvidence?.labResultV4?.siteAssessment;

  if (siteAssessment) {
    // Extract business model from executive summary or narrative
    const narrative = siteAssessment.executiveSummary || siteAssessment.summary || '';
    const businessModelMatch = extractBusinessModelFromText(narrative);

    if (businessModelMatch) {
      candidates.push({
        fieldKey: 'identity.businessModel',
        value: businessModelMatch.value,
        confidence: businessModelMatch.confidence,
        sourceType: 'website_lab',
        sourceRunId: run.id,
        evidence: {
          source: 'Website Lab',
          runId: run.id,
          snippets: [narrative.slice(0, 200)],
          urls: [],
        },
      });
    }
  }

  return candidates;
}

/**
 * Extract candidates from GAP Plan results
 */
function extractGapPlanCandidates(run: DiagnosticRun): DiagnosticCandidate[] {
  const candidates: DiagnosticCandidate[] = [];

  if (!run.rawJson) {
    console.log('[ProposalGenerator] GAP Plan run has no rawJson');
    return candidates;
  }

  const raw = run.rawJson as any;

  // Try different paths for GAP Plan data
  const gapData = raw.gapPlan || raw.plan || raw;

  // Extract business model
  const businessModel = gapData.businessModel || gapData.identity?.businessModel;
  if (businessModel && typeof businessModel === 'string') {
    candidates.push({
      fieldKey: 'identity.businessModel',
      value: businessModel,
      confidence: 90,
      sourceType: 'full_gap',
      sourceRunId: run.id,
      evidence: {
        source: 'Full GAP Report',
        runId: run.id,
        snippets: [businessModel.slice(0, 200)],
        urls: [],
      },
    });
  }

  // Extract ICP description
  const icpDescription = gapData.icpDescription || gapData.audience?.icpDescription || gapData.targetAudience;
  if (icpDescription && typeof icpDescription === 'string') {
    candidates.push({
      fieldKey: 'audience.icpDescription',
      value: icpDescription,
      confidence: 85,
      sourceType: 'full_gap',
      sourceRunId: run.id,
      evidence: {
        source: 'Full GAP Report',
        runId: run.id,
        snippets: [icpDescription.slice(0, 200)],
        urls: [],
      },
    });
  }

  // Extract brand positioning
  const positioning = gapData.positioning || gapData.brand?.positioning;
  if (positioning && typeof positioning === 'string') {
    candidates.push({
      fieldKey: 'brand.positioning',
      value: positioning,
      confidence: 85,
      sourceType: 'full_gap',
      sourceRunId: run.id,
      evidence: {
        source: 'Full GAP Report',
        runId: run.id,
        snippets: [positioning.slice(0, 200)],
        urls: [],
      },
    });
  }

  // Extract differentiators
  const differentiators = gapData.differentiators || gapData.brand?.differentiators;
  if (differentiators) {
    const diffValue = Array.isArray(differentiators)
      ? differentiators.join('\n')
      : String(differentiators);

    if (diffValue) {
      candidates.push({
        fieldKey: 'brand.differentiators',
        value: diffValue,
        confidence: 80,
        sourceType: 'full_gap',
        sourceRunId: run.id,
        evidence: {
          source: 'Full GAP Report',
          runId: run.id,
          snippets: [diffValue.slice(0, 200)],
          urls: [],
        },
      });
    }
  }

  return candidates;
}

/**
 * Extract candidates from GAP IA results
 */
function extractGapIaCandidates(run: DiagnosticRun): DiagnosticCandidate[] {
  const candidates: DiagnosticCandidate[] = [];

  if (!run.rawJson) {
    console.log('[ProposalGenerator] GAP IA run has no rawJson');
    return candidates;
  }

  const raw = run.rawJson as any;
  const ia = raw.initialAssessment || raw;

  // Extract from summary or dimensions
  const summary = ia.summary || {};

  // Try to extract business model from summary narrative
  if (summary.narrative) {
    const businessModelMatch = extractBusinessModelFromText(summary.narrative);
    if (businessModelMatch) {
      candidates.push({
        fieldKey: 'identity.businessModel',
        value: businessModelMatch.value,
        confidence: businessModelMatch.confidence,
        sourceType: 'gap_ia',
        sourceRunId: run.id,
        evidence: {
          source: 'GAP Initial Assessment',
          runId: run.id,
          snippets: [summary.narrative.slice(0, 200)],
          urls: [],
        },
      });
    }
  }

  return candidates;
}

/**
 * Extract candidates from Audience Lab results
 */
function extractAudienceLabCandidates(run: DiagnosticRun): DiagnosticCandidate[] {
  const candidates: DiagnosticCandidate[] = [];

  if (!run.rawJson) {
    console.log('[ProposalGenerator] Audience Lab run has no rawJson');
    return candidates;
  }

  const raw = run.rawJson as any;

  // Try to find ICP description
  const icpDescription = raw.icpDescription ||
    raw.icp?.description ||
    raw.primaryAudience ||
    raw.personas?.[0]?.description;

  if (icpDescription && typeof icpDescription === 'string') {
    candidates.push({
      fieldKey: 'audience.icpDescription',
      value: icpDescription,
      confidence: 80,
      sourceType: 'audience_lab',
      sourceRunId: run.id,
      evidence: {
        source: 'Audience Lab',
        runId: run.id,
        snippets: [icpDescription.slice(0, 200)],
        urls: [],
      },
    });
  }

  return candidates;
}

/**
 * Extract candidates from Competition Lab results
 */
function extractCompetitionLabCandidates(run: DiagnosticRun): DiagnosticCandidate[] {
  const candidates: DiagnosticCandidate[] = [];

  if (!run.rawJson) {
    console.log('[ProposalGenerator] Competition Lab run has no rawJson');
    return candidates;
  }

  const raw = run.rawJson as any;

  // Extract differentiators from competitive analysis
  const differentiators = raw.differentiators ||
    raw.competitiveAdvantages ||
    raw.positioning?.differentiators;

  if (differentiators) {
    const diffValue = Array.isArray(differentiators)
      ? differentiators.join('\n')
      : String(differentiators);

    if (diffValue) {
      candidates.push({
        fieldKey: 'brand.differentiators',
        value: diffValue,
        confidence: 75,
        sourceType: 'competition_lab',
        sourceRunId: run.id,
        evidence: {
          source: 'Competition Lab',
          runId: run.id,
          snippets: [diffValue.slice(0, 200)],
          urls: [],
        },
      });
    }
  }

  return candidates;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract business model from text using pattern matching
 */
function extractBusinessModelFromText(text: string): { value: string; confidence: number } | null {
  if (!text || text.length < 20) return null;

  const lowerText = text.toLowerCase();

  // Known business model patterns
  const patterns: Array<{ regex: RegExp; model: string; confidence: number }> = [
    { regex: /\b(two[- ]sided)\s+marketplace/i, model: 'Two-sided marketplace', confidence: 85 },
    { regex: /\bmarketplace\b/i, model: 'Marketplace', confidence: 70 },
    { regex: /\bsaas\b|\bsoftware[- ]as[- ]a[- ]service/i, model: 'SaaS', confidence: 85 },
    { regex: /\bsubscription[- ]based/i, model: 'Subscription-based service', confidence: 80 },
    { regex: /\be[- ]?commerce\b/i, model: 'E-commerce', confidence: 75 },
    { regex: /\blead[- ]gen(eration)?\b/i, model: 'Lead generation', confidence: 75 },
    { regex: /\bagency\b/i, model: 'Agency/consulting', confidence: 70 },
    { regex: /\bconsulting\b/i, model: 'Consulting', confidence: 70 },
    { regex: /\bfreemium\b/i, model: 'Freemium', confidence: 80 },
    { regex: /\bb2b\b/i, model: 'B2B', confidence: 65 },
    { regex: /\bb2c\b/i, model: 'B2C', confidence: 65 },
  ];

  for (const { regex, model, confidence } of patterns) {
    if (regex.test(text)) {
      return { value: model, confidence };
    }
  }

  // If no pattern found but text describes a business, extract first sentence
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  if (sentences.length > 0) {
    const firstSentence = sentences[0].trim();
    if (firstSentence.length < 200) {
      return { value: firstSentence, confidence: 55 };
    }
  }

  return null;
}

/**
 * Load existing proposals for a company to check for duplicates
 */
async function loadExistingProposals(companyId: string): Promise<ContextProposal[]> {
  try {
    const base = getBase();
    const records = await base(AIRTABLE_TABLES.CONTEXT_PROPOSALS)
      .select({
        filterByFormula: `AND({Company ID} = "${companyId}", OR({Status} = "proposed", {Status} = "confirmed"))`,
        maxRecords: 100,
      })
      .all();

    return records.map(record => ({
      id: record.id,
      companyId: (record.fields['Company ID'] as string) || companyId,
      fieldKey: (record.fields['Field Key'] as string) || '',
      proposedValue: (record.fields['Proposed Value'] as string) || '',
      status: (record.fields['Status'] as any) || 'proposed',
      sourceType: (record.fields['Source Type'] as PromotionSourceType) || 'manual',
      sourceRunId: (record.fields['Source Run ID'] as string) || undefined,
      evidence: (record.fields['Evidence'] as string) || '',
      confidence: (record.fields['Confidence'] as number) || 0,
      createdAt: (record.fields['Created At'] as string) || new Date().toISOString(),
      decidedAt: (record.fields['Decided At'] as string) || undefined,
      decidedBy: (record.fields['Decided By'] as string) || undefined,
    }));
  } catch (error) {
    console.warn('[ProposalGenerator] Failed to load existing proposals:', error);
    return [];
  }
}

/**
 * Deduplicate candidates against existing proposals
 */
function deduplicateCandidates(
  candidates: DiagnosticCandidate[],
  existingProposals: ContextProposal[]
): DiagnosticCandidate[] {
  const existingKeys = new Set<string>();

  for (const proposal of existingProposals) {
    // Create a key based on fieldKey and normalized value
    const normalizedValue = normalizeValue(proposal.proposedValue);
    existingKeys.add(`${proposal.fieldKey}:${normalizedValue}`);
  }

  return candidates.filter(candidate => {
    const normalizedValue = normalizeValue(candidate.value);
    const key = `${candidate.fieldKey}:${normalizedValue}`;
    return !existingKeys.has(key);
  });
}

/**
 * Normalize a value for deduplication comparison
 */
function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Create proposals in Airtable
 */
async function createProposals(
  companyId: string,
  candidates: DiagnosticCandidate[]
): Promise<ContextProposal[]> {
  const created: ContextProposal[] = [];

  try {
    const base = getBase();

    for (const candidate of candidates) {
      const evidenceString = formatEvidence(candidate.evidence);

      const fields: Record<string, unknown> = {
        'Company ID': companyId,
        'Field Key': candidate.fieldKey,
        'Proposed Value': candidate.value,
        'Status': 'proposed',
        'Source Type': candidate.sourceType,
        'Source Run ID': candidate.sourceRunId || '',
        'Evidence': evidenceString,
        'Confidence': candidate.confidence,
        'Created At': new Date().toISOString(),
      };

      const record = await base(AIRTABLE_TABLES.CONTEXT_PROPOSALS).create([{ fields: fields as any }]);

      if (record && record[0]) {
        created.push({
          id: record[0].id,
          companyId,
          fieldKey: candidate.fieldKey,
          proposedValue: candidate.value,
          status: 'proposed',
          sourceType: candidate.sourceType,
          sourceRunId: candidate.sourceRunId,
          evidence: evidenceString,
          confidence: candidate.confidence,
          createdAt: new Date().toISOString(),
        });
      }
    }

    console.log('[ProposalGenerator] Created proposals:', created.length);
    return created;
  } catch (error) {
    console.error('[ProposalGenerator] Failed to create proposals:', error);
    return created;
  }
}

/**
 * Format evidence for storage
 */
function formatEvidence(evidence: ProposalEvidence): string {
  const parts: string[] = [];

  parts.push(`Source: ${evidence.source}${evidence.runId ? ` (${evidence.runId})` : ''}`);

  if (evidence.snippets && evidence.snippets.length > 0) {
    for (const snippet of evidence.snippets.slice(0, 2)) {
      if (snippet) {
        parts.push(`"${snippet.slice(0, 300)}"`);
      }
    }
  }

  if (evidence.urls && evidence.urls.length > 0) {
    parts.push(`URLs: ${evidence.urls.join(', ')}`);
  }

  return parts.join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export {
  type DiagnosticCandidate,
  type GenerateProposalsOptions,
  extractBusinessModelFromText,
};
