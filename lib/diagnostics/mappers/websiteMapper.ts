// lib/diagnostics/mappers/websiteMapper.ts
// Website Diagnostic → Action Board Mapper
//
// This mapper converts existing Website Lab results and Action Plans
// into the generic DiagnosticActionBoard format.

import type { WebsiteActionPlan, WebsiteWorkItem } from '@/lib/gap-heavy/modules/websiteActionPlan';
import type { WebsiteUXLabResultV4 } from '@/lib/gap-heavy/modules/websiteLab';
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
 * Convert Website Action Plan to generic Diagnostic Action Board
 *
 * @param actionPlan - Website-specific action plan
 * @param labResult - Full Website Lab result (optional, for enrichment)
 * @param companyId - Company ID
 * @param companyName - Company name (optional)
 * @param companyUrl - Company URL (optional)
 * @param runId - Diagnostic run ID (optional)
 * @returns Generic action board
 */
export function mapWebsiteToActionBoard(
  actionPlan: WebsiteActionPlan,
  companyId: string,
  options?: {
    labResult?: WebsiteUXLabResultV4;
    companyName?: string;
    companyUrl?: string;
    runId?: string;
  }
): DiagnosticActionBoard {
  const { labResult, companyName, companyUrl, runId } = options || {};

  // Map themes
  const themes: DiagnosticTheme[] = actionPlan.keyThemes.map((theme) => ({
    id: theme.id,
    label: theme.label,
    description: theme.description,
    priority: theme.priority,
    linkedDimensions: theme.linkedDimensions || [],
    linkedPersonas: theme.linkedPersonas || [],
    linkedPages: theme.linkedPages || [],
    expectedImpactSummary: theme.expectedImpactSummary,
  }));

  // Map work items to actions
  const now = mapWorkItemsToActions(actionPlan.now);
  const next = mapWorkItemsToActions(actionPlan.next);
  const later = mapWorkItemsToActions(actionPlan.later);

  // Map experiments
  const experiments: ExperimentIdea[] = (actionPlan.experiments || []).map((exp) => ({
    id: exp.id,
    hypothesis: exp.hypothesis,
    description: exp.description,
    metric: exp.metric,
    scope: exp.pages || [],
    expectedLift: exp.expectedLift,
    effortScore: exp.effortScore,
  }));

  // Map strategic changes
  const strategicProjects: StrategicProject[] = (actionPlan.strategicChanges || []).map((change) => ({
    id: change.id,
    title: change.title,
    description: change.description,
    reasoning: change.reasoning,
    linkedFindings: change.linkedFindings || [],
  }));

  // Extract filter options
  const allActions = [...now, ...next, ...later];
  const filterOptions = extractFilterOptions(allActions);

  // Build metadata
  const pagesAnalyzed = labResult?.siteGraph?.pages?.length || undefined;

  // Extract tech stack from homepage evidence (first page or "/" path)
  let techStack: { platform: string | null; confidence: number; signals: string[] } | undefined;
  if (labResult?.siteGraph?.pages?.length) {
    const homePage = labResult.siteGraph.pages.find(p => p.path === '/') || labResult.siteGraph.pages[0];
    if (homePage?.evidenceV3?.techStack) {
      techStack = homePage.evidenceV3.techStack;
    }
  }

  return {
    diagnosticType: 'website',
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
      pagesAnalyzed,
      custom: {
        // Website-specific metadata
        hasPersonaSimulation: (labResult?.personas?.length || 0) > 0,
        hasIntelligenceEngines: !!labResult?.ctaIntelligence,
        // Tech stack detection
        techStack,
      },
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map Website work items to generic diagnostic actions
 */
function mapWorkItemsToActions(workItems: WebsiteWorkItem[]): DiagnosticAction[] {
  return workItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    rationale: item.rationale,
    dimension: item.dimension,
    serviceArea: item.serviceArea as ServiceArea,
    impactScore: item.impactScore,
    effortScore: item.effortScore,
    estimatedLift: item.estimatedLift,
    bucket: item.priority as ActionBucket, // 'now', 'next', 'later'
    tags: item.tags || [],
    personas: extractPersonasFromEvidence(item.evidenceRefs),
    pages: extractPagesFromEvidence(item.evidenceRefs),
    evidenceRefs: (item.evidenceRefs || []).map((ref) => ({
      type: inferEvidenceType(ref),
      id: ref,
      description: undefined,
    })),
    playbook: inferPlaybook(item),
    recommendedRole: item.recommendedAssigneeRole,
    recommendedTimebox: item.recommendedTimebox,
    status: item.status,
  }));
}

/**
 * Extract personas from evidence refs
 */
function extractPersonasFromEvidence(evidenceRefs?: string[]): string[] | undefined {
  if (!evidenceRefs) return undefined;

  const personas = evidenceRefs
    .filter((ref) => ref.startsWith('persona-'))
    .map((ref) => ref.replace('persona-', '').replace(/_/g, ' '));

  return personas.length > 0 ? personas : undefined;
}

/**
 * Extract pages from evidence refs
 */
function extractPagesFromEvidence(evidenceRefs?: string[]): string[] | undefined {
  if (!evidenceRefs) return undefined;

  const pages = evidenceRefs
    .filter((ref) => ref.startsWith('/'))
    .map((ref) => ref);

  return pages.length > 0 ? pages : undefined;
}

/**
 * Infer evidence type from reference string
 */
function inferEvidenceType(ref: string): string {
  if (ref.startsWith('issue-')) return 'issue';
  if (ref.startsWith('persona-')) return 'persona';
  if (ref.startsWith('heuristic-')) return 'heuristic';
  if (ref.startsWith('impact-')) return 'impact-matrix';
  if (ref.startsWith('conv-')) return 'conversion-strategist';
  if (ref.startsWith('copy-')) return 'copywriting-strategist';
  if (ref.startsWith('/')) return 'page';
  return 'other';
}

/**
 * Infer playbook grouping from work item
 */
function inferPlaybook(item: WebsiteWorkItem): string | undefined {
  const tags = item.tags || [];
  const title = item.title.toLowerCase();
  const description = item.description.toLowerCase();

  // CTA Overhaul
  if (tags.includes('cta') || /cta|call.?to.?action|button/i.test(title + description)) {
    return 'CTA Overhaul';
  }

  // Trust Signals
  if (tags.includes('trust') || /trust|testimonial|social.?proof|logo/i.test(title + description)) {
    return 'Trust Signals';
  }

  // Hero & Value Prop
  if (tags.includes('hero') || /hero|value.?prop/i.test(title + description)) {
    return 'Hero & Value Prop';
  }

  // Pricing & Transparency
  if (tags.includes('pricing') || /pricing|price|cost/i.test(title + description)) {
    return 'Pricing & Transparency';
  }

  // Navigation & Structure
  if (tags.includes('navigation') || /navigation|nav|menu|structure/i.test(title + description)) {
    return 'Navigation & Structure';
  }

  // Mobile Experience
  if (tags.includes('mobile') || /mobile|responsive/i.test(title + description)) {
    return 'Mobile Experience';
  }

  // Content & Messaging
  if (tags.includes('content') || /content|copy|messaging/i.test(title + description)) {
    return 'Content & Messaging';
  }

  // Visual & Brand
  if (tags.includes('visual') || /visual|design|brand/i.test(title + description)) {
    return 'Visual & Brand';
  }

  return undefined; // No playbook
}

/**
 * Extract filter options from actions
 */
function extractFilterOptions(actions: DiagnosticAction[]) {
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
