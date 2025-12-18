// app/api/os/strategy/ai-fill-frame/route.ts
// AI-powered Strategic Frame generation
//
// Uses company context and diagnostics to suggest frame values.
// Returns suggestions only - user must explicitly apply.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy } from '@/lib/os/strategy';
import type { StrategyFrame } from '@/lib/types/strategy';
import { normalizeFrame } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface AiFillFrameRequest {
  companyId: string;
}

interface AiFillFrameResponse {
  suggestedFrame: StrategyFrame;
  reasoning: string;
  sourcesUsed: string[];
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: AiFillFrameRequest = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing required field: companyId' },
        { status: 400 }
      );
    }

    // Get company context and current strategy
    const [context, strategy] = await Promise.all([
      getCompanyContext(companyId),
      getActiveStrategy(companyId),
    ]);

    // Get current frame (if any) for comparison
    const currentFrame = normalizeFrame(strategy?.strategyFrame);

    // Generate frame suggestions from context
    const suggestedFrame = generateFrameFromContext(context, currentFrame);

    // Track what sources were used
    const sourcesUsed: string[] = [];
    if (context?.icpDescription) sourcesUsed.push('ICP Description');
    if (context?.primaryAudience) sourcesUsed.push('Primary Audience');
    if (context?.valueProposition) sourcesUsed.push('Value Proposition');
    if (context?.companyCategory) sourcesUsed.push('Company Category');
    if (context?.businessModel) sourcesUsed.push('Business Model');
    if (context?.complianceRequirements?.length || context?.platformRestrictions) sourcesUsed.push('Constraints');

    const response: AiFillFrameResponse = {
      suggestedFrame,
      reasoning: `Generated frame suggestions based on ${sourcesUsed.length} context sources: ${sourcesUsed.join(', ') || 'none available'}.`,
      sourcesUsed,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] ai-fill-frame error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate frame suggestions' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Frame Generation Logic
// ============================================================================

function generateFrameFromContext(
  context: Awaited<ReturnType<typeof getCompanyContext>>,
  currentFrame: StrategyFrame
): StrategyFrame {
  const suggested: StrategyFrame = {};

  if (!context) return suggested;

  // Audience: Combine ICP description and primary audience
  if (!currentFrame.audience) {
    const audienceParts: string[] = [];
    if (context.icpDescription) audienceParts.push(context.icpDescription);
    if (context.primaryAudience && !context.icpDescription?.includes(context.primaryAudience)) {
      audienceParts.push(`Primary: ${context.primaryAudience}`);
    }
    if (audienceParts.length > 0) {
      suggested.audience = audienceParts.join('. ');
    }
  }

  // Offering: Use business model or company category
  if (!currentFrame.offering) {
    if (context.businessModel) {
      suggested.offering = context.businessModel;
    } else if (context.companyCategory) {
      suggested.offering = `${context.companyCategory} solutions`;
    }
  }

  // Value Proposition
  if (!currentFrame.valueProp) {
    if (context.valueProposition) {
      suggested.valueProp = context.valueProposition;
    }
  }

  // Positioning: Build from differentiators and category
  if (!currentFrame.positioning) {
    const positioningParts: string[] = [];
    if (context.differentiators && context.differentiators.length > 0) {
      positioningParts.push(`Key differentiators: ${context.differentiators.join(', ')}`);
    }
    if (context.companyCategory) {
      positioningParts.push(`Category: ${context.companyCategory}`);
    }
    if (positioningParts.length > 0) {
      suggested.positioning = positioningParts.join('. ');
    }
  }

  // Constraints: Combine compliance requirements and platform restrictions
  if (!currentFrame.constraints) {
    const constraintParts: string[] = [];
    if (context.complianceRequirements && context.complianceRequirements.length > 0) {
      constraintParts.push(`Compliance: ${context.complianceRequirements.join(', ')}`);
    }
    if (context.platformRestrictions) constraintParts.push(context.platformRestrictions);
    if (context.constraints) constraintParts.push(context.constraints);
    if (constraintParts.length > 0) {
      suggested.constraints = constraintParts.join('. ');
    }
  }

  // Success Metrics: Use goals if available
  if (!currentFrame.successMetrics || currentFrame.successMetrics.length === 0) {
    if (context.objectives && context.objectives.length > 0) {
      // Extract objective texts as potential success metrics
      const metrics = context.objectives
        .slice(0, 3)
        .map(obj => typeof obj === 'string' ? obj : (obj as { text?: string }).text || String(obj))
        .filter(Boolean);
      if (metrics.length > 0) {
        suggested.successMetrics = metrics;
      }
    }
  }

  // Non-Goals: Could be derived from explicit exclusions in context
  // For now, leave empty as this is harder to infer
  // Users should explicitly define what they're NOT doing

  return suggested;
}
