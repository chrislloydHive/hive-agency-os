// app/api/os/dev/seed-strategy-demo/route.ts
// DEV-ONLY: Seed real Airtable-backed demo data for strategy loop testing
//
// POST /api/os/dev/seed-strategy-demo
// Headers: x-demo-seed-key: <DEMO_SEED_KEY env var>
// Body: { companyId, strategyId, mode?: "reset"|"append" }
//
// GUARDS:
// - Only runs when NODE_ENV !== "production"
// - Requires x-demo-seed-key header matching env DEMO_SEED_KEY

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import {
  createOutcomeSignals,
  deleteDemoSignals,
  type CreateOutcomeSignalInput,
} from '@/lib/airtable/outcomeSignals';
import {
  deleteDraftProposals,
  getRevisionProposals,
} from '@/lib/airtable/strategyRevisionProposals';
import type { StrategyRevisionProposal } from '@/lib/types/strategyRevision';

export const dynamic = 'force-dynamic';

const DEMO_TAG = 'demo_seed_v1';

// ============================================================================
// Guards
// ============================================================================

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function validateSeedKey(request: NextRequest): boolean {
  const headerKey = request.headers.get('x-demo-seed-key');
  const envKey = process.env.DEMO_SEED_KEY;

  // In development without DEMO_SEED_KEY set, allow any key for convenience
  if (!envKey && isDevEnvironment()) {
    return true;
  }

  return headerKey === envKey;
}

// ============================================================================
// Demo Signal Templates
// ============================================================================

interface SignalTemplate {
  signalType: 'completed' | 'abandoned' | 'high-impact' | 'low-impact' | 'learning';
  confidence: 'low' | 'medium' | 'high';
  summary: string;
  evidence: string[];
  offsetDays: number; // Relative to appliedAt
  source: 'artifact' | 'work' | 'experiment' | 'manual';
  tacticIds?: string[];
  objectiveIds?: string[];
}

// Pre-apply signals (before the proposal apply event)
const PRE_APPLY_SIGNALS: SignalTemplate[] = [
  {
    signalType: 'low-impact',
    confidence: 'high',
    summary: 'Social media content showing minimal engagement lift',
    evidence: ['Average engagement rate of 1.2% vs 3.5% benchmark', '15 posts analyzed over 30 days'],
    offsetDays: -21,
    source: 'artifact',
    tacticIds: ['social-media-content'],
  },
  {
    signalType: 'abandoned',
    confidence: 'medium',
    summary: 'Email nurture sequence discontinued after 2 sends',
    evidence: ['Sequence started but only 2 of 6 emails sent', 'No completions in 45 days'],
    offsetDays: -18,
    source: 'work',
    tacticIds: ['email-nurture'],
  },
  {
    signalType: 'learning',
    confidence: 'high',
    summary: 'Customer research reveals preference for educational content',
    evidence: ['8 of 12 customer interviews mentioned wanting "how-to" guides over promotional content'],
    offsetDays: -14,
    source: 'manual',
    objectiveIds: ['content-strategy'],
  },
  {
    signalType: 'high-impact',
    confidence: 'high',
    summary: 'Case study driving 40% of qualified leads',
    evidence: ['Attribution shows case study page as top converter', '127 leads in 30 days'],
    offsetDays: -10,
    source: 'artifact',
    tacticIds: ['case-studies'],
    objectiveIds: ['lead-generation'],
  },
  {
    signalType: 'low-impact',
    confidence: 'medium',
    summary: 'Paid social ads underperforming cost targets',
    evidence: ['CPA of $145 vs $80 target', '3 campaigns tested over 21 days'],
    offsetDays: -7,
    source: 'experiment',
    tacticIds: ['paid-social'],
  },
];

// Post-apply signals (after the proposal apply event) - show improvement
const POST_APPLY_SIGNALS: SignalTemplate[] = [
  {
    signalType: 'completed',
    confidence: 'high',
    summary: 'New content calendar launched with educational focus',
    evidence: ['First 8 educational posts published', 'Initial engagement 2.8x higher than previous content'],
    offsetDays: 3,
    source: 'work',
    tacticIds: ['content-strategy'],
  },
  {
    signalType: 'high-impact',
    confidence: 'high',
    summary: 'Educational webinar series exceeding registration targets',
    evidence: ['450 registrations vs 200 goal', '62% attendance rate', '23 qualified opportunities'],
    offsetDays: 10,
    source: 'artifact',
    tacticIds: ['webinars', 'lead-generation'],
    objectiveIds: ['demand-generation'],
  },
  {
    signalType: 'learning',
    confidence: 'medium',
    summary: 'Sales team reporting better lead quality from new content',
    evidence: ['Qualitative feedback from 5 SDRs', 'Conversion to meeting improved from 12% to 18%'],
    offsetDays: 15,
    source: 'manual',
    objectiveIds: ['sales-enablement'],
  },
];

// Additional post-proposal signals for clear attribution lift
const LATE_POST_SIGNALS: SignalTemplate[] = [
  {
    signalType: 'high-impact',
    confidence: 'high',
    summary: 'Content-driven leads showing 35% higher close rate',
    evidence: ['Q4 cohort analysis: educational content leads close at 28% vs 21% for other sources'],
    offsetDays: 20,
    source: 'artifact',
    tacticIds: ['content-strategy'],
    objectiveIds: ['revenue-impact'],
  },
  {
    signalType: 'completed',
    confidence: 'high',
    summary: 'Full content library migration to educational format complete',
    evidence: ['45 pieces migrated', 'New template adopted by team', 'Style guide updated'],
    offsetDays: 25,
    source: 'work',
    tacticIds: ['content-operations'],
  },
];

// ============================================================================
// Helpers
// ============================================================================

function generateDeterministicId(prefix: string, index: number, seedRunId: string): string {
  return `${prefix}_${seedRunId}_${index}`;
}

function offsetDate(baseDate: Date, days: number): string {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function signalTemplateToInput(
  template: SignalTemplate,
  companyId: string,
  strategyId: string,
  baseDate: Date,
  index: number,
  seedRunId: string
): CreateOutcomeSignalInput {
  return {
    companyId,
    strategyId,
    source: template.source,
    sourceId: generateDeterministicId('src', index, seedRunId),
    signalType: template.signalType,
    confidence: template.confidence,
    summary: template.summary,
    evidence: template.evidence,
    tacticIds: template.tacticIds,
    objectiveIds: template.objectiveIds,
    createdAt: offsetDate(baseDate, template.offsetDays),
    demoTag: DEMO_TAG,
    seedRunId,
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  // Guard: Production check
  if (!isDevEnvironment()) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  // Guard: Seed key validation
  if (!validateSeedKey(request)) {
    return NextResponse.json(
      { error: 'Invalid or missing x-demo-seed-key header' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { companyId, strategyId, mode = 'reset' } = body;

    if (!companyId || !strategyId) {
      return NextResponse.json(
        { error: 'companyId and strategyId are required' },
        { status: 400 }
      );
    }

    const seedRunId = nanoid(8);
    const appliedAt = new Date();
    const createdCounts = {
      signalsDeleted: 0,
      proposalsDeleted: 0,
      preSignals: 0,
      postSignals: 0,
      lateSignals: 0,
      proposalsGenerated: 0,
    };

    // ========================================================================
    // Step 1: Reset mode - delete prior demo records
    // ========================================================================
    if (mode === 'reset') {
      // Delete demo-tagged signals
      const signalsDeleted = await deleteDemoSignals(companyId, strategyId, DEMO_TAG);
      createdCounts.signalsDeleted = signalsDeleted;

      // Delete all draft proposals (cleaner than tracking demoTag on proposals)
      const proposalsDeleted = await deleteDraftProposals(companyId, strategyId);
      createdCounts.proposalsDeleted = proposalsDeleted;

      console.log(
        `[seed-strategy-demo] Reset: deleted ${signalsDeleted} signals, ${proposalsDeleted} draft proposals`
      );
    }

    // ========================================================================
    // Step 2: Seed pre-apply outcome signals
    // ========================================================================
    const preSignalInputs = PRE_APPLY_SIGNALS.map((template, index) =>
      signalTemplateToInput(template, companyId, strategyId, appliedAt, index, seedRunId)
    );

    const preSignals = await createOutcomeSignals(preSignalInputs);
    createdCounts.preSignals = preSignals.length;
    console.log(`[seed-strategy-demo] Created ${preSignals.length} pre-apply signals`);

    // ========================================================================
    // Step 3: Generate revision proposals using REAL generator
    // ========================================================================
    const baseUrl = request.nextUrl.origin;
    const proposalsResponse = await fetch(
      `${baseUrl}/api/os/companies/${companyId}/strategy/${strategyId}/revision-proposals`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward any auth headers
          ...(request.headers.get('cookie')
            ? { Cookie: request.headers.get('cookie')! }
            : {}),
        },
      }
    );

    let proposals: StrategyRevisionProposal[] = [];
    if (proposalsResponse.ok) {
      const proposalsData = await proposalsResponse.json();
      proposals = proposalsData.proposals || [];
      createdCounts.proposalsGenerated = proposals.length;
      console.log(`[seed-strategy-demo] Generated ${proposals.length} proposals`);
    } else {
      console.warn(
        `[seed-strategy-demo] Proposal generation returned ${proposalsResponse.status}`
      );
    }

    // ========================================================================
    // Step 4: Apply highest-impact proposal
    // ========================================================================
    let appliedProposalId: string | null = null;

    if (proposals.length > 0) {
      // Prioritize: high confidence first, then by number of changes
      const sortedProposals = [...proposals].sort((a, b) => {
        const confOrder = { high: 3, medium: 2, low: 1 };
        const confDiff = confOrder[b.confidence] - confOrder[a.confidence];
        if (confDiff !== 0) return confDiff;
        return b.changes.length - a.changes.length;
      });

      const proposalToApply = sortedProposals[0];

      // Apply via the real endpoint
      const applyResponse = await fetch(
        `${baseUrl}/api/os/companies/${companyId}/strategy/${strategyId}/revision-proposals/${proposalToApply.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(request.headers.get('cookie')
              ? { Cookie: request.headers.get('cookie')! }
              : {}),
          },
          body: JSON.stringify({
            action: 'apply',
            forceApply: true, // Skip confirmation for demo
          }),
        }
      );

      if (applyResponse.ok) {
        appliedProposalId = proposalToApply.id;
        console.log(`[seed-strategy-demo] Applied proposal: ${appliedProposalId}`);
      } else {
        console.warn(
          `[seed-strategy-demo] Apply proposal returned ${applyResponse.status}`
        );
      }
    }

    // ========================================================================
    // Step 5: Seed post-apply signals
    // ========================================================================
    const postSignalInputs = POST_APPLY_SIGNALS.map((template, index) =>
      signalTemplateToInput(
        template,
        companyId,
        strategyId,
        appliedAt,
        index + PRE_APPLY_SIGNALS.length,
        seedRunId
      )
    );

    const postSignals = await createOutcomeSignals(postSignalInputs);
    createdCounts.postSignals = postSignals.length;
    console.log(`[seed-strategy-demo] Created ${postSignals.length} post-apply signals`);

    // ========================================================================
    // Step 6: Seed late post signals for attribution lift
    // ========================================================================
    const lateSignalInputs = LATE_POST_SIGNALS.map((template, index) =>
      signalTemplateToInput(
        template,
        companyId,
        strategyId,
        appliedAt,
        index + PRE_APPLY_SIGNALS.length + POST_APPLY_SIGNALS.length,
        seedRunId
      )
    );

    const lateSignals = await createOutcomeSignals(lateSignalInputs);
    createdCounts.lateSignals = lateSignals.length;
    console.log(`[seed-strategy-demo] Created ${lateSignals.length} late post signals`);

    // ========================================================================
    // Return summary
    // ========================================================================
    return NextResponse.json({
      status: 'success',
      seedRunId,
      appliedAt: appliedAt.toISOString(),
      appliedProposalId,
      createdCounts: {
        signalsDeleted: createdCounts.signalsDeleted,
        proposalsDeleted: createdCounts.proposalsDeleted,
        signalsCreated:
          createdCounts.preSignals + createdCounts.postSignals + createdCounts.lateSignals,
        proposalsGenerated: createdCounts.proposalsGenerated,
        breakdown: {
          preSignals: createdCounts.preSignals,
          postSignals: createdCounts.postSignals,
          lateSignals: createdCounts.lateSignals,
        },
      },
    });
  } catch (error) {
    console.error('[seed-strategy-demo] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed demo data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
