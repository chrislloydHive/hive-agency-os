// components/os/blueprint/types.ts
// Shared types for Blueprint components

import type { CompanyToolId, ToolCategory, ToolIcon, BlueprintToolMeta } from '@/lib/tools/registry';
import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { DiagnosticRunStatus, DiagnosticToolId } from '@/lib/os/diagnostics/runs';
import type { CompanyAlert } from '@/lib/os/companies/alerts';
import type { PerformancePulse } from '@/lib/os/analytics/performancePulse';
import type {
  BlueprintPipelineData,
  ToolRunStatus,
} from '@/lib/blueprint/pipeline';
import type {
  StrategySynthesis,
  StrategicFocusArea,
  PrioritizedAction,
} from '@/lib/blueprint/synthesizer';
import type {
  BlueprintAnalyticsSummary,
  AnalyticsStrategicInsight,
} from '@/lib/os/analytics/blueprintDataFetcher';
import type { CompanySummary } from '@/lib/os/companySummary';

// Re-export CompanySummary for components that need it
export type { CompanySummary } from '@/lib/os/companySummary';

export interface CompanyData {
  id: string;
  name: string;
  website?: string | null;
  domain?: string;
  industry?: string | null;
  ga4PropertyId?: string | null;
  searchConsoleSiteUrl?: string | null;
  hasMediaProgram?: boolean;
}

/**
 * Utility to extract CompanyData from CompanySummary
 * Enables gradual migration to CompanySummary without breaking existing code
 */
export function companyDataFromSummary(summary: CompanySummary): CompanyData {
  return {
    id: summary.companyId,
    name: summary.meta.name,
    website: summary.meta.url,
    domain: summary.meta.domain || undefined,
    industry: null, // Not tracked in CompanySummary currently
    ga4PropertyId: null, // Would need to add to CompanySummary if needed
    searchConsoleSiteUrl: null,
    hasMediaProgram: summary.media.hasMediaProgram,
  };
}

export interface RecentDiagnostic {
  id: string;
  toolId: DiagnosticToolId;
  toolLabel: string;
  status: DiagnosticRunStatus;
  score: number | null;
  completedAt?: string | null;
  reportPath?: string | null;
  createdAt: string;
}

export interface BrainSummary {
  total: number;
  recentCount?: number;
  byCategory: Record<string, number>;
}

export interface SerializedRecommendedTool {
  toolId: CompanyToolId;
  scoreImpact: 'high' | 'medium' | 'low';
  urgency: 'now' | 'next' | 'later';
  reason: string;
  blueprintMeta: BlueprintToolMeta;
  hasRecentRun: boolean;
  lastRunAt?: string;
  lastScore?: number | null;
  lastRunId?: string;
  daysSinceRun: number | null;
  lastRunStatus?: 'complete' | 'failed' | 'running';
  toolLabel: string;
  toolDescription: string;
  toolCategory: ToolCategory;
  toolIcon: ToolIcon;
  runApiPath?: string;
  urlSlug?: string;
  requiresWebsite?: boolean;
  estimatedMinutes?: number;
}

export interface BlueprintClientProps {
  company: CompanyData;
  strategySnapshot: CompanyStrategicSnapshot | null;
  recentDiagnostics: RecentDiagnostic[];
  alerts: CompanyAlert[];
  performancePulse?: PerformancePulse | null;
  brainSummary: BrainSummary | null;
  pipelineData?: BlueprintPipelineData | null;
  strategySynthesis?: StrategySynthesis | null;
  analyticsSummary?: BlueprintAnalyticsSummary | null;
  analyticsInsights?: AnalyticsStrategicInsight[];
  recommendedTools?: SerializedRecommendedTool[];
}

// Re-export types that components need
export type {
  CompanyStrategicSnapshot,
  CompanyAlert,
  PerformancePulse,
  BlueprintPipelineData,
  ToolRunStatus,
  StrategySynthesis,
  StrategicFocusArea,
  PrioritizedAction,
  BlueprintAnalyticsSummary,
  AnalyticsStrategicInsight,
  CompanyToolId,
  ToolIcon,
};
