// lib/diagnostics/mappers/brandMapper.ts
// Brand Diagnostic → Action Board Mapper
//
// This mapper converts Brand Lab results and Action Plans
// into the generic DiagnosticActionBoard format.

import type { BrandActionPlan, BrandWorkItem } from '@/lib/gap-heavy/modules/brandLab';
import type { BrandDiagnosticResult, BrandLabResult } from '@/lib/gap-heavy/modules/brandLab';
import type {
  DiagnosticActionBoard,
  DiagnosticAction,
  DiagnosticTheme,
  ExperimentIdea,
  StrategicProject,
  ServiceArea,
  ActionBucket,
} from '../types';

// ============================================================================
// MAIN MAPPER FUNCTION
// ============================================================================

/**
 * Convert Brand Action Plan to generic Diagnostic Action Board
 *
 * @param actionPlan - Brand-specific action plan
 * @param companyId - Company ID
 * @param options - Optional metadata (labResult, companyName, etc.)
 * @returns Generic action board
 */
export function mapBrandToActionBoard(
  actionPlan: BrandActionPlan,
  companyId: string,
  options?: {
    labResult?: BrandLabResult;
    companyName?: string;
    companyUrl?: string;
    runId?: string;
    maturityStage?: string | null;
    dataConfidence?: {
      level: 'low' | 'medium' | 'high';
      score: number;
      reason?: string;
    } | null;
  }
): DiagnosticActionBoard {
  const { labResult, companyName, companyUrl, runId, maturityStage, dataConfidence } = options || {};

  // Map themes
  const themes: DiagnosticTheme[] = actionPlan.keyThemes.map((theme) => ({
    id: theme.id,
    label: theme.label,
    description: theme.description,
    priority: theme.priority,
    linkedDimensions: theme.linkedDimensions || [],
    expectedImpactSummary: theme.expectedImpactSummary,
  }));

  // Map work items to actions
  const now = mapBrandWorkItemsToActions(actionPlan.now);
  const next = mapBrandWorkItemsToActions(actionPlan.next);
  const later = mapBrandWorkItemsToActions(actionPlan.later);

  // Map experiments
  const experiments: ExperimentIdea[] = (actionPlan.experiments || []).map((exp) => ({
    id: exp.id,
    hypothesis: exp.hypothesis,
    description: exp.description,
    metric: exp.metric,
    expectedImpact: exp.expectedImpact,
    effortScore: exp.effortScore,
    serviceArea: 'brand',
  }));

  // Map strategic changes
  const strategicProjects: StrategicProject[] = (actionPlan.strategicChanges || []).map((change) => ({
    id: change.id,
    title: change.title,
    description: change.description,
    reasoning: change.reasoning,
    linkedFindings: change.linkedFindings || [],
    serviceAreas: ['brand'],
  }));

  // Extract filter options
  const allActions = [...now, ...next, ...later];
  const filterOptions = extractBrandFilterOptions(allActions);

  // Build metadata
  const diagnostic = labResult?.diagnostic;

  return {
    diagnosticType: 'brand',
    companyId,
    companyName,
    targetUrl: companyUrl,
    overallScore: actionPlan.overallScore,
    gradeLabel: actionPlan.benchmarkLabel,
    summary: actionPlan.summary,
    themes,
    now,
    next,
    later,
    experiments,
    strategicProjects,
    filterOptions,
    metadata: {
      runDate: new Date().toISOString(),
      runId,
      custom: {
        // Brand-specific metadata
        brandPillarsCount: diagnostic?.brandPillars?.length || 0,
        inconsistenciesCount: diagnostic?.inconsistencies?.length || 0,
        opportunitiesCount: diagnostic?.opportunities?.length || 0,
        risksCount: diagnostic?.risks?.length || 0,
        // Maturity and data confidence
        maturityStage: maturityStage || null,
        dataConfidence: dataConfidence || null,
      },
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map Brand work items to generic diagnostic actions
 */
function mapBrandWorkItemsToActions(workItems: BrandWorkItem[]): DiagnosticAction[] {
  return workItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    rationale: item.rationale,
    dimension: item.dimension as string,
    serviceArea: item.serviceArea as ServiceArea,
    impactScore: item.impactScore,
    effortScore: item.effortScore,
    estimatedLift: typeof item.estimatedLift === 'string'
      ? parseFloat(item.estimatedLift) || undefined
      : item.estimatedLift,
    bucket: item.priority as ActionBucket, // 'now', 'next', 'later'
    tags: item.tags || [],
    evidenceRefs: (item.evidenceRefs || []).map((ref) => ({
      type: inferBrandEvidenceType(ref),
      id: ref,
      description: undefined,
    })),
    playbook: inferBrandPlaybook(item),
    recommendedRole: item.recommendedAssigneeRole,
    recommendedTimebox: item.recommendedTimebox,
    status: item.status,
  }));
}

/**
 * Infer evidence type from reference string for brand diagnostics
 */
function inferBrandEvidenceType(ref: string): string {
  if (ref.startsWith('pillar-')) return 'pillar';
  if (ref.startsWith('identity-')) return 'identity';
  if (ref.startsWith('messaging-')) return 'messaging';
  if (ref.startsWith('positioning-')) return 'positioning';
  if (ref.startsWith('visual-')) return 'visual';
  if (ref.startsWith('trust-')) return 'trust';
  if (ref.startsWith('audience-')) return 'audience';
  if (ref.startsWith('asset-')) return 'asset';
  if (ref.startsWith('inconsistency-')) return 'inconsistency';
  if (ref.startsWith('opportunity-')) return 'opportunity';
  if (ref.startsWith('risk-')) return 'risk';
  if (ref.startsWith('/')) return 'page';
  return 'other';
}

/**
 * Infer playbook grouping from brand work item
 */
function inferBrandPlaybook(item: BrandWorkItem): string | undefined {
  const tags = item.tags || [];
  const title = item.title.toLowerCase();
  const description = item.description.toLowerCase();

  // Brand Identity & Guidelines
  if (tags.includes('identity') || /identity|guidelines|brand.?guide/i.test(title + description)) {
    return 'Brand Identity & Guidelines';
  }

  // Messaging & Positioning
  if (tags.includes('messaging') || tags.includes('positioning') || /messaging|positioning|tagline|value.?prop/i.test(title + description)) {
    return 'Messaging & Positioning';
  }

  // Visual Consistency
  if (tags.includes('visual') || /visual|logo|color|typography|design/i.test(title + description)) {
    return 'Visual Consistency';
  }

  // Trust & Credibility
  if (tags.includes('trust') || /trust|credibility|proof|testimonial/i.test(title + description)) {
    return 'Trust & Credibility';
  }

  // Audience & Market Fit
  if (tags.includes('audience') || /audience|market|persona|target/i.test(title + description)) {
    return 'Audience & Market Fit';
  }

  // Brand Assets
  if (tags.includes('assets') || /assets|photo|video|content.?bank/i.test(title + description)) {
    return 'Brand Assets';
  }

  return undefined; // No playbook
}

/**
 * Extract filter options from brand actions
 */
function extractBrandFilterOptions(actions: DiagnosticAction[]) {
  const tags = new Set<string>();
  const personas = new Set<string>();
  const serviceAreas = new Set<ServiceArea>();
  const playbooks = new Set<string>();

  for (const action of actions) {
    // Collect tags
    if (action.tags) {
      action.tags.forEach((tag) => tags.add(tag));
    }

    // Collect personas
    if (action.personas) {
      action.personas.forEach((persona) => personas.add(persona));
    }

    // Collect service areas
    serviceAreas.add(action.serviceArea);

    // Collect playbooks
    if (action.playbook) {
      playbooks.add(action.playbook);
    }
  }

  return {
    tags: Array.from(tags).sort(),
    personas: Array.from(personas).sort(),
    serviceAreas: Array.from(serviceAreas).sort(),
    playbooks: Array.from(playbooks).sort(),
  };
}
