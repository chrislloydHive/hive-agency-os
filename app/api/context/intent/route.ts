// app/api/context/intent/route.ts
// Intent classification and routing API
//
// Phase 4: Context Intent Engine

import { NextRequest, NextResponse } from 'next/server';
import {
  classifyIntent,
  routeIntent,
  validateIntentContext,
  type AutonomyLevel,
} from '@/lib/contextGraph/intent';
import { loadContextGraphRecord } from '@/lib/contextGraph/storage';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

export const runtime = 'nodejs';

/**
 * POST /api/context/intent
 *
 * Classify a user request and route it to the appropriate agent.
 *
 * Body:
 * - request: The user's request string
 * - companyId: Company ID for context
 * - currentDomain?: Current domain the user is viewing
 * - currentPath?: Current field path the user is viewing
 * - autonomyLevel?: Desired autonomy level for execution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      request: userRequest,
      companyId,
      currentDomain,
      currentPath,
      autonomyLevel = 'ai_assisted',
    } = body;

    if (!userRequest || typeof userRequest !== 'string') {
      return NextResponse.json(
        { error: 'request is required and must be a string' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Get company context graph
    const graphRecord = await loadContextGraphRecord(companyId);
    if (!graphRecord) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Classify the intent
    const intent = await classifyIntent(userRequest, {
      currentDomain: currentDomain as DomainName | undefined,
      currentPath,
      graph: graphRecord.graph,
    });

    // Route to appropriate agent
    const route = routeIntent(
      intent,
      graphRecord.graph,
      autonomyLevel as AutonomyLevel
    );

    // Validate context requirements
    const validation = validateIntentContext(intent, graphRecord.graph);

    return NextResponse.json({
      intent,
      route,
      validation,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[intent] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/context/intent
 *
 * Get available intent types and agent capabilities.
 */
export async function GET() {
  // Import agent capabilities
  const { AGENT_CAPABILITIES } = await import('@/lib/contextGraph/intent/router');

  return NextResponse.json({
    intentCategories: [
      'optimize',
      'diagnose',
      'create',
      'update',
      'analyze',
      'forecast',
      'fix',
      'compare',
      'explain',
      'automate',
    ],
    intentTypes: [
      // Media
      'optimize_media_plan',
      'diagnose_media_performance',
      'create_media_plan',
      'forecast_media_spend',
      'analyze_channel_performance',
      // Creative
      'create_creative_brief',
      'optimize_creative_angles',
      'diagnose_creative_fatigue',
      'analyze_creative_performance',
      // Audience
      'update_audience_segments',
      'diagnose_audience_fit',
      'create_personas',
      'analyze_audience_behavior',
      // SEO
      'diagnose_seo_issues',
      'optimize_keyword_strategy',
      'analyze_search_visibility',
      'forecast_seo_impact',
      // Brand
      'update_brand_positioning',
      'diagnose_brand_consistency',
      'analyze_brand_perception',
      // Strategy
      'create_executive_summary',
      'forecast_seasonality',
      'analyze_competitive_landscape',
      'diagnose_strategy_gaps',
      // Context graph
      'fix_inconsistent_data',
      'update_stale_fields',
      'explain_field_value',
      'compare_snapshots',
    ],
    agents: AGENT_CAPABILITIES.map(a => ({
      type: a.agentType,
      name: a.name,
      description: a.description,
      supportedIntents: a.supportedIntents,
      supportedDomains: a.supportedDomains,
      maxAutonomyLevel: a.maxAutonomyLevel,
    })),
    autonomyLevels: [
      { level: 'manual_only', description: 'Requires human initiation and approval' },
      { level: 'ai_assisted', description: 'AI suggests, human approves' },
      { level: 'semi_autonomous', description: 'AI executes with human review' },
      { level: 'fully_autonomous', description: 'AI executes independently' },
    ],
  });
}
