// lib/gap/orchestrator/labPlan.ts
// Determines which Labs need to run to fill Context Graph gaps

import type { LabId } from '@/lib/contextGraph/labContext';
import type { ContextHealthAssessment, LabRunPlan, LabRunPlanItem } from './types';

// ============================================================================
// Field-to-Lab Mapping
// ============================================================================

/**
 * Maps Context Graph fields to the Lab that can best populate them.
 * Format: 'domain.field' -> LabId
 */
const FIELD_TO_LAB_MAP: Record<string, LabId> = {
  // Identity / Brand fields -> Brand Lab
  'identity.primaryCompetitors': 'brand',
  'brand.positioning': 'brand',
  'brand.pillars': 'brand',
  'brand.keyDifferentiators': 'brand',
  'brand.voiceTone': 'brand',
  'brand.messagingPillars': 'brand',

  // Audience fields -> Audience Lab
  'audience.icpDefinition': 'audience',
  'audience.segments': 'audience',
  'audience.jtbd': 'audience',
  'audience.buyingJourney': 'audience',
  'audience.topPainPoints': 'audience',
  'audience.motivations': 'audience',

  // Creative / Messaging fields -> Creative Lab
  'creative.messagingEcosystem': 'creative',
  'creative.campaignConcepts': 'creative',
  'creative.proofPoints': 'creative',

  // Website fields -> Website Lab
  'website.ctaAnalysis': 'website',
  'website.conversionFactors': 'website',
  'website.messagingClarity': 'website',
  'website.uxIssues': 'website',

  // SEO fields -> SEO Lab
  'seo.technicalIssues': 'seo',
  'seo.contentGaps': 'seo',
  'seo.keywordOpportunities': 'seo',
  'seo.authoritySignals': 'seo',

  // Content fields -> Content Lab
  'content.inventory': 'content',
  'content.topicClusters': 'content',
  'content.contentGaps': 'content',
  'content.performingContent': 'content',

  // Media fields -> Media Lab
  'performanceMedia.channelMix': 'media',
  'performanceMedia.budgetAllocation': 'media',
  'performanceMedia.objectives': 'media',
  'performanceMedia.kpis': 'media',

  // Ops fields -> Ops Lab
  'ops.toolStack': 'ops',
  'ops.processMaturity': 'ops',
  'ops.automationLevel': 'ops',
  'ops.dataQuality': 'ops',

  // Demand fields -> Demand Lab
  'digitalInfra.funnelStages': 'demand',
  'digitalInfra.leadCapture': 'demand',
  'digitalInfra.nurtureSequences': 'demand',
};

/**
 * Lab metadata for planning
 */
const LAB_METADATA: Record<LabId, { name: string; estimatedDurationMs: number; priority: number }> = {
  brand: { name: 'Brand Lab', estimatedDurationMs: 45000, priority: 2 },
  audience: { name: 'Audience Lab', estimatedDurationMs: 60000, priority: 1 },
  creative: { name: 'Creative Lab', estimatedDurationMs: 40000, priority: 4 },
  website: { name: 'Website Lab', estimatedDurationMs: 90000, priority: 3 },
  seo: { name: 'SEO Lab', estimatedDurationMs: 120000, priority: 5 },
  content: { name: 'Content Lab', estimatedDurationMs: 60000, priority: 6 },
  media: { name: 'Media Lab', estimatedDurationMs: 45000, priority: 7 },
  ops: { name: 'Ops Lab', estimatedDurationMs: 30000, priority: 8 },
  demand: { name: 'Demand Lab', estimatedDurationMs: 60000, priority: 4 },
  ux: { name: 'UX Lab', estimatedDurationMs: 45000, priority: 3 },
  competitor: { name: 'Competitor Lab', estimatedDurationMs: 60000, priority: 5 },
};

// ============================================================================
// Lab Plan Generation
// ============================================================================

/**
 * Determines which Labs need to run based on missing context fields.
 *
 * @param health - Context health assessment with missing fields
 * @param forceLabs - Optional labs to always include
 * @param skipLabs - Optional labs to exclude
 * @returns Lab run plan with prioritized labs
 */
export function determineLabsNeededForMissingFields(
  health: ContextHealthAssessment,
  forceLabs?: LabId[],
  skipLabs?: LabId[]
): LabRunPlan {
  const labFieldsMap = new Map<LabId, string[]>();

  // Map missing fields to labs
  for (const field of health.missingCriticalFields) {
    const labId = FIELD_TO_LAB_MAP[field];
    if (labId && (!skipLabs || !skipLabs.includes(labId))) {
      const existing = labFieldsMap.get(labId) || [];
      existing.push(field);
      labFieldsMap.set(labId, existing);
    }
  }

  // Also consider stale fields
  for (const field of health.staleFields) {
    const labId = FIELD_TO_LAB_MAP[field];
    if (labId && (!skipLabs || !skipLabs.includes(labId))) {
      const existing = labFieldsMap.get(labId) || [];
      if (!existing.includes(field)) {
        existing.push(field);
        labFieldsMap.set(labId, existing);
      }
    }
  }

  // Add forced labs
  if (forceLabs) {
    for (const labId of forceLabs) {
      if (!labFieldsMap.has(labId) && (!skipLabs || !skipLabs.includes(labId))) {
        labFieldsMap.set(labId, ['forced']);
      }
    }
  }

  // Build plan items
  const labs: LabRunPlanItem[] = [];
  for (const [labId, fields] of labFieldsMap) {
    const meta = LAB_METADATA[labId];
    if (meta) {
      labs.push({
        labId,
        labName: meta.name,
        reason: fields.includes('forced')
          ? 'Forced by request'
          : `Missing fields: ${fields.slice(0, 3).join(', ')}${fields.length > 3 ? '...' : ''}`,
        fieldsToFill: fields.filter(f => f !== 'forced'),
        priority: meta.priority,
        estimatedDurationMs: meta.estimatedDurationMs,
      });
    }
  }

  // Sort by priority (lower number = higher priority)
  labs.sort((a, b) => a.priority - b.priority);

  // Calculate totals
  const totalEstimatedDurationMs = labs.reduce((sum, lab) => sum + lab.estimatedDurationMs, 0);
  const missingFieldsCount = health.missingCriticalFields.length + health.staleFields.length;

  return {
    labs,
    totalEstimatedDurationMs,
    missingFieldsCount,
  };
}

/**
 * Get all labs that could potentially provide context for a company.
 * Used when doing a full refresh.
 */
export function getAllAvailableLabs(skipLabs?: LabId[]): LabRunPlan {
  const labs: LabRunPlanItem[] = [];

  for (const [labId, meta] of Object.entries(LAB_METADATA)) {
    if (skipLabs && skipLabs.includes(labId as LabId)) continue;

    labs.push({
      labId: labId as LabId,
      labName: meta.name,
      reason: 'Full refresh',
      fieldsToFill: Object.entries(FIELD_TO_LAB_MAP)
        .filter(([, lab]) => lab === labId)
        .map(([field]) => field),
      priority: meta.priority,
      estimatedDurationMs: meta.estimatedDurationMs,
    });
  }

  labs.sort((a, b) => a.priority - b.priority);

  return {
    labs,
    totalEstimatedDurationMs: labs.reduce((sum, lab) => sum + lab.estimatedDurationMs, 0),
    missingFieldsCount: 0,
  };
}

/**
 * Get fields that a specific lab can populate
 */
export function getFieldsForLab(labId: LabId): string[] {
  return Object.entries(FIELD_TO_LAB_MAP)
    .filter(([, lab]) => lab === labId)
    .map(([field]) => field);
}

/**
 * Get the lab that can best populate a specific field
 */
export function getLabForField(field: string): LabId | null {
  return FIELD_TO_LAB_MAP[field] || null;
}
