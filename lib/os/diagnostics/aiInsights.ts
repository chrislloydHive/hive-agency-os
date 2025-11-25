// lib/os/diagnostics/aiInsights.ts
// AI Insights types and client utilities for diagnostic tools
//
// This module provides types for AI-generated insights and a client-side
// helper for fetching insights from the API.

import type { DiagnosticToolId } from './runs';

// ============================================================================
// Types
// ============================================================================

/**
 * Suggested experiment from AI analysis
 */
export interface DiagnosticExperiment {
  name: string;
  hypothesis: string;
  steps: string[];
  successMetric: string;
}

/**
 * Suggested work item from AI analysis
 */
export interface SuggestedWorkItem {
  title: string;
  area: 'strategy' | 'website' | 'brand' | 'content' | 'seo' | 'demand' | 'ops';
  description: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * AI-generated insights for a diagnostic run
 */
export interface DiagnosticInsights {
  summary: string;
  strengths: string[];
  issues: string[];
  quickWins: string[];
  experiments: DiagnosticExperiment[];
  suggestedWorkItems: SuggestedWorkItem[];
}

/**
 * Response from the AI insights API
 */
export interface DiagnosticInsightsResponse {
  toolId: DiagnosticToolId;
  companyId: string;
  runId: string;
  insights: DiagnosticInsights;
  generatedAt: string;
}

/**
 * Error response from the AI insights API
 */
export interface DiagnosticInsightsError {
  error: string;
  toolId?: DiagnosticToolId;
  companyId?: string;
}

// ============================================================================
// Tool-Specific System Prompts
// ============================================================================

/**
 * Get the system prompt for a specific diagnostic tool
 */
export function getToolSystemPrompt(toolId: DiagnosticToolId): string {
  const prompts: Record<DiagnosticToolId, string> = {
    gapSnapshot: `You are Hive OS GAP Snapshot Analyzer. You analyze initial marketing assessments that score companies on their overall marketing maturity.

The data includes:
- Overall marketing scores (0-100)
- Maturity stage classification
- Channel presence analysis
- Basic brand and content metrics

Focus your analysis on:
- Quick wins that can improve scores immediately
- The most impactful areas to address first
- Red flags that indicate deeper issues
- Competitive positioning insights`,

    gapPlan: `You are Hive OS GAP Plan Analyzer. You analyze comprehensive Growth Acceleration Plans that include strategic initiatives and 90-day roadmaps.

The data includes:
- Strategic initiatives with priorities
- Quick wins and immediate actions
- 90-day implementation roadmap
- Resource allocation recommendations

Focus your analysis on:
- Whether the initiatives align with business goals
- Sequencing and dependencies between initiatives
- Risk factors and mitigation strategies
- Success metrics and measurement approaches`,

    websiteLab: `You are Hive OS Website Lab Analyzer. You analyze multi-page website UX and conversion diagnostics.

The data includes:
- Page-by-page UX assessments
- Conversion optimization opportunities
- CTA effectiveness analysis
- Messaging clarity scores
- Technical performance metrics

Focus your analysis on:
- Conversion blockers and friction points
- User experience improvements
- Messaging and copy recommendations
- Technical optimizations for performance`,

    brandLab: `You are Hive OS Brand Lab Analyzer. You analyze brand health, clarity, and positioning assessments.

The data includes:
- Brand coherence scores
- Visual identity consistency
- Messaging alignment
- Competitive differentiation analysis
- Brand promise delivery

Focus your analysis on:
- Brand clarity and memorability
- Consistency across touchpoints
- Differentiation opportunities
- Brand story effectiveness`,

    contentLab: `You are Hive OS Content Lab Analyzer. You analyze content inventory and quality assessments.

The data includes:
- Content audit results
- Blog and resource analysis
- Case study effectiveness
- Content strategy alignment
- SEO content metrics

Focus your analysis on:
- Content gaps and opportunities
- Quality improvements needed
- Topic authority building
- Content distribution effectiveness`,

    seoLab: `You are Hive OS SEO Lab Analyzer. You analyze search engine optimization diagnostics.

The data includes:
- Technical SEO audit results
- Keyword ranking analysis
- Backlink profile assessment
- Content optimization scores
- Search visibility metrics

Focus your analysis on:
- Technical SEO fixes
- Content optimization opportunities
- Link building strategies
- Competitive keyword gaps`,

    demandLab: `You are Hive OS Demand Lab Analyzer. You analyze demand generation and funnel diagnostics.

The data includes:
- Lead capture effectiveness
- Funnel conversion rates
- Campaign performance
- Nurture flow analysis
- Attribution data

Focus your analysis on:
- Funnel leak identification
- Lead quality improvements
- Campaign optimization
- Nurture sequence effectiveness`,

    opsLab: `You are Hive OS Ops Lab Analyzer. You analyze marketing operations and process assessments.

The data includes:
- Process efficiency scores
- Tool stack analysis
- Automation coverage
- Data quality metrics
- Team capacity utilization

Focus your analysis on:
- Process bottlenecks
- Automation opportunities
- Tool consolidation
- Data hygiene improvements`,
  };

  return prompts[toolId] || prompts.gapSnapshot;
}

// ============================================================================
// Client Utilities
// ============================================================================

/**
 * Fetch AI insights for a diagnostic tool
 */
export async function fetchToolInsights(
  toolId: DiagnosticToolId,
  companyId: string,
  runId?: string
): Promise<DiagnosticInsightsResponse> {
  const response = await fetch(`/api/os/diagnostics/ai-insights/${toolId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, runId }),
  });

  if (!response.ok) {
    const error: DiagnosticInsightsError = await response.json().catch(() => ({
      error: `Failed to fetch insights: ${response.status}`,
    }));
    throw new Error(error.error);
  }

  return response.json();
}

/**
 * Create an empty insights object for loading/error states
 */
export function createEmptyInsights(): DiagnosticInsights {
  return {
    summary: '',
    strengths: [],
    issues: [],
    quickWins: [],
    experiments: [],
    suggestedWorkItems: [],
  };
}
