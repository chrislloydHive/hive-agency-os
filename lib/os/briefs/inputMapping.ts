// lib/os/briefs/inputMapping.ts
// Input mapping rules for brief generation
//
// Input Mapping Rules (MUST BE ENFORCED):
//
// Context → Brief:
//   - Audience/ICP → targetAudience
//   - Constraints → constraints
//   - Brand attributes → tone (creative/campaign types only)
//   - Execution capabilities → assumptions or constraints
//
// GAP → Brief:
//   - Primary blockers → problemToSolve
//   - Ranked opportunities → influences objective
//   - Confidence + blind spots → assumptions
//
// Strategic Bets → Brief (DECISION LAYER):
//   - ONLY accepted bets may flow through
//   - Bet intent → singleMindedFocus
//   - Bet pros → supportingMessages
//   - Bet tradeoffs → assumptions
//   - Bet scope/exclusions → constraints

import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getLatestOsGapFullReportForCompany } from '@/lib/airtable/gapFullReports';
import { getProjectStrategyByProjectId } from '@/lib/airtable/projectStrategies';
import type { BriefType, BriefGenerationContext } from '@/lib/types/brief';

// ============================================================================
// Types
// ============================================================================

export interface MappedBriefInputs {
  // From Context
  contextInputs: {
    targetAudience: string;
    brandAttributes: string;
    constraints: string[];
    capabilities: string[];
  };

  // From GAP
  gapInputs: {
    primaryBlockers: string[];
    rankedOpportunities: string[];
    confidenceLevel: number;
    blindSpots: string[];
  };

  // From Strategic Bets (accepted only)
  betInputs: {
    acceptedBets: Array<{
      id: string;
      title: string;
      intent: string;
      pros: string[];
      cons: string[];
      tradeoffs: string[];
      scope?: string;
      exclusions?: string[];
    }>;
  };

  // Traceability
  traceability: {
    contextSnapshotId?: string;
    gapRunId?: string;
    strategicBetIds: string[];
  };
}

// ============================================================================
// Mapping Functions
// ============================================================================

/**
 * Load and map all inputs for brief generation
 */
export async function loadBriefInputs(
  companyId: string,
  projectId?: string
): Promise<MappedBriefInputs> {
  // Initialize with defaults
  const inputs: MappedBriefInputs = {
    contextInputs: {
      targetAudience: '',
      brandAttributes: '',
      constraints: [],
      capabilities: [],
    },
    gapInputs: {
      primaryBlockers: [],
      rankedOpportunities: [],
      confidenceLevel: 0,
      blindSpots: [],
    },
    betInputs: {
      acceptedBets: [],
    },
    traceability: {
      strategicBetIds: [],
    },
  };

  // 1. Load Context
  await loadContextInputs(companyId, inputs);

  // 2. Load GAP
  await loadGapInputs(companyId, inputs);

  // 3. Load Strategic Bets (accepted only)
  if (projectId) {
    await loadBetInputs(projectId, inputs);
  }

  return inputs;
}

/**
 * Map context graph to brief inputs
 */
async function loadContextInputs(
  companyId: string,
  inputs: MappedBriefInputs
): Promise<void> {
  try {
    const contextGraph = await loadContextGraph(companyId);

    if (!contextGraph) {
      console.warn('[InputMapping] No context graph found');
      return;
    }

    inputs.traceability.contextSnapshotId = companyId;

    // Map audience
    const audience = contextGraph.audience;
    if (audience) {
      const audienceParts: string[] = [];

      if (audience.primaryAudience?.value) {
        audienceParts.push(audience.primaryAudience.value as string);
      }

      // Use defensive access for fields that may not exist in schema
      const audienceAny = audience as Record<string, { value?: unknown }>;
      if (audienceAny.audienceSegments?.value) {
        const segments = audienceAny.audienceSegments.value as string[];
        if (segments.length > 0) {
          audienceParts.push(`Key segments: ${segments.join(', ')}`);
        }
      }

      if (audienceAny.audiencePainPoints?.value) {
        const painPoints = audienceAny.audiencePainPoints.value as string[];
        if (painPoints.length > 0) {
          audienceParts.push(`Pain points: ${painPoints.join(', ')}`);
        }
      }

      inputs.contextInputs.targetAudience = audienceParts.join('\n\n');
    }

    // Map brand attributes
    const brand = contextGraph.brand;
    if (brand) {
      const brandParts: string[] = [];

      // Use actual BrandDomain field names
      if (brand.toneOfVoice?.value) {
        brandParts.push(`Tone of Voice: ${brand.toneOfVoice.value}`);
      }

      if (brand.brandPersonality?.value) {
        brandParts.push(`Brand Personality: ${brand.brandPersonality.value}`);
      }

      if (brand.positioning?.value) {
        brandParts.push(`Positioning: ${brand.positioning.value}`);
      }

      if (brand.messagingPillars?.value) {
        const pillars = brand.messagingPillars.value as string[];
        if (pillars.length > 0) {
          brandParts.push(`Messaging Pillars: ${pillars.join(', ')}`);
        }
      }

      if (brand.valueProps?.value) {
        const props = brand.valueProps.value as string[];
        if (props.length > 0) {
          brandParts.push(`Value Props: ${props.join(', ')}`);
        }
      }

      inputs.contextInputs.brandAttributes = brandParts.join('\n');
    }

    // Map constraints from ops
    const ops = contextGraph.ops;
    if (ops) {
      const opsAny = ops as Record<string, { value?: unknown }>;
      if (opsAny.executionConstraints?.value) {
        const constraints = opsAny.executionConstraints.value as string[];
        inputs.contextInputs.constraints.push(...constraints);
      }

      if (opsAny.channelCapabilities?.value) {
        const capabilities = opsAny.channelCapabilities.value as string[];
        inputs.contextInputs.capabilities.push(...capabilities);
      }
    }

    // Map operational constraints
    const operationalConstraints = contextGraph.operationalConstraints;
    if (operationalConstraints) {
      const constraintsAny = operationalConstraints as Record<string, { value?: unknown }>;
      if (constraintsAny.budgetRange?.value) {
        inputs.contextInputs.constraints.push(
          `Budget: ${constraintsAny.budgetRange.value}`
        );
      }

      if (constraintsAny.timelineConstraints?.value) {
        inputs.contextInputs.constraints.push(
          `Timeline: ${constraintsAny.timelineConstraints.value}`
        );
      }
    }
  } catch (error) {
    console.error('[InputMapping] Failed to load context:', error);
  }
}

/**
 * Map GAP report to brief inputs
 */
async function loadGapInputs(
  companyId: string,
  inputs: MappedBriefInputs
): Promise<void> {
  try {
    const rawReport = await getLatestOsGapFullReportForCompany(companyId);

    if (!rawReport) {
      console.warn('[InputMapping] No GAP report found');
      return;
    }

    inputs.traceability.gapRunId = rawReport.id;

    // Extract diagnostics JSON for detailed insights
    const diagnosticsJson = rawReport.fields?.['Diagnostics JSON'] as string | undefined;
    if (diagnosticsJson) {
      try {
        const diagnostics = JSON.parse(diagnosticsJson);

        // Extract primary blockers from top issues
        if (diagnostics.topIssues && Array.isArray(diagnostics.topIssues)) {
          inputs.gapInputs.primaryBlockers = diagnostics.topIssues
            .slice(0, 5)
            .map((issue: { title?: string; description?: string }) =>
              issue.title || issue.description || ''
            )
            .filter(Boolean);
        }

        // Extract opportunities
        if (diagnostics.opportunities && Array.isArray(diagnostics.opportunities)) {
          inputs.gapInputs.rankedOpportunities = diagnostics.opportunities
            .slice(0, 5)
            .map((opp: { title?: string; description?: string }) =>
              opp.title || opp.description || ''
            )
            .filter(Boolean);
        }

        // Extract confidence/blind spots
        if (diagnostics.blindSpots && Array.isArray(diagnostics.blindSpots)) {
          inputs.gapInputs.blindSpots = diagnostics.blindSpots;
        }

        if (typeof diagnostics.confidenceScore === 'number') {
          inputs.gapInputs.confidenceLevel = diagnostics.confidenceScore;
        }
      } catch (e) {
        console.error('[InputMapping] Failed to parse diagnostics JSON:', e);
      }
    }

    // Fallback to extracted fields if diagnostics not available
    if (inputs.gapInputs.primaryBlockers.length === 0) {
      const topIssue1 = rawReport.fields?.['Top Issue 1'] as string | undefined;
      const topIssue2 = rawReport.fields?.['Top Issue 2'] as string | undefined;
      const topIssue3 = rawReport.fields?.['Top Issue 3'] as string | undefined;

      if (topIssue1) inputs.gapInputs.primaryBlockers.push(topIssue1);
      if (topIssue2) inputs.gapInputs.primaryBlockers.push(topIssue2);
      if (topIssue3) inputs.gapInputs.primaryBlockers.push(topIssue3);
    }

    // Get overall score as proxy for confidence
    const overallScore = rawReport.fields?.['Overall Score'] as number | undefined;
    if (overallScore && inputs.gapInputs.confidenceLevel === 0) {
      inputs.gapInputs.confidenceLevel = overallScore;
    }
  } catch (error) {
    console.error('[InputMapping] Failed to load GAP:', error);
  }
}

/**
 * Map strategic bets to brief inputs (ACCEPTED BETS ONLY)
 */
async function loadBetInputs(
  projectId: string,
  inputs: MappedBriefInputs
): Promise<void> {
  try {
    const strategy = await getProjectStrategyByProjectId(projectId);

    if (!strategy) {
      console.warn('[InputMapping] No project strategy found');
      return;
    }

    // CRITICAL: Only accepted bets flow through
    const acceptedBets = (strategy.strategicBets || []).filter(
      (bet) => bet.status === 'accepted'
    );

    inputs.betInputs.acceptedBets = acceptedBets.map((bet) => ({
      id: bet.id,
      title: bet.title,
      intent: bet.intent || '',
      pros: bet.pros || [],
      cons: bet.cons || [],
      tradeoffs: bet.tradeoffs || [],
    }));

    inputs.traceability.strategicBetIds = acceptedBets.map((bet) => bet.id);
  } catch (error) {
    console.error('[InputMapping] Failed to load bets:', error);
  }
}

/**
 * Build brief generation context from mapped inputs
 */
export function buildGenerationContext(
  inputs: MappedBriefInputs
): BriefGenerationContext {
  return {
    contextSnapshot: {
      id: inputs.traceability.contextSnapshotId || '',
      audience: inputs.contextInputs.targetAudience,
      brand: inputs.contextInputs.brandAttributes,
      constraints: inputs.contextInputs.constraints,
    },
    gapData: {
      runId: inputs.traceability.gapRunId || '',
      primaryBlockers: inputs.gapInputs.primaryBlockers,
      rankedOpportunities: inputs.gapInputs.rankedOpportunities,
      confidenceLevel: inputs.gapInputs.confidenceLevel,
      blindSpots: inputs.gapInputs.blindSpots,
    },
    acceptedBets: inputs.betInputs.acceptedBets,
  };
}

/**
 * Derive brief core fields from mapped inputs
 *
 * This applies the input mapping rules:
 * - Context audience → targetAudience
 * - GAP blockers → problemToSolve
 * - Bet intent → singleMindedFocus
 * - Bet tradeoffs + GAP blind spots → assumptions
 * - Context constraints + bet exclusions → constraints
 */
export function deriveCoreSuggestions(inputs: MappedBriefInputs): {
  objective: string;
  targetAudience: string;
  problemToSolve: string;
  singleMindedFocus: string;
  constraints: string[];
  assumptions: string[];
} {
  // Target audience from context
  const targetAudience = inputs.contextInputs.targetAudience;

  // Problem to solve from GAP blockers
  const problemToSolve = inputs.gapInputs.primaryBlockers.length > 0
    ? inputs.gapInputs.primaryBlockers[0]
    : '';

  // Single-minded focus from first accepted bet intent
  const primaryBet = inputs.betInputs.acceptedBets[0];
  const singleMindedFocus = primaryBet?.intent || '';

  // Objective combines GAP opportunities with bet goals
  const objectiveParts: string[] = [];
  if (inputs.gapInputs.rankedOpportunities.length > 0) {
    objectiveParts.push(inputs.gapInputs.rankedOpportunities[0]);
  }
  if (primaryBet?.title) {
    objectiveParts.push(primaryBet.title);
  }
  const objective = objectiveParts.join(' - ');

  // Constraints from context + bet exclusions
  const constraints: string[] = [...inputs.contextInputs.constraints];
  for (const bet of inputs.betInputs.acceptedBets) {
    if (bet.exclusions) {
      constraints.push(...bet.exclusions);
    }
  }

  // Assumptions from GAP blind spots + bet tradeoffs
  const assumptions: string[] = [...inputs.gapInputs.blindSpots];
  for (const bet of inputs.betInputs.acceptedBets) {
    if (bet.tradeoffs.length > 0) {
      assumptions.push(...bet.tradeoffs);
    }
  }

  return {
    objective,
    targetAudience,
    problemToSolve,
    singleMindedFocus,
    constraints,
    assumptions,
  };
}

/**
 * Derive creative/campaign extension suggestions from mapped inputs
 */
export function deriveCreativeExtensionSuggestions(inputs: MappedBriefInputs): {
  keyMessage: string;
  supportingMessages: string[];
  tone: string;
} {
  const primaryBet = inputs.betInputs.acceptedBets[0];

  // Key message from bet intent
  const keyMessage = primaryBet?.intent || '';

  // Supporting messages from bet pros
  const supportingMessages: string[] = [];
  for (const bet of inputs.betInputs.acceptedBets) {
    supportingMessages.push(...bet.pros);
  }

  // Tone from brand attributes
  const tone = inputs.contextInputs.brandAttributes
    .split('\n')
    .find((line) => line.toLowerCase().includes('tone'))
    ?.replace(/^tone:\s*/i, '')
    || '';

  return {
    keyMessage,
    supportingMessages,
    tone,
  };
}
