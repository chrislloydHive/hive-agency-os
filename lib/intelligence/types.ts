// lib/intelligence/types.ts
// Types for OS Intelligence Layer

// ============================================================================
// OS Health Summary Types
// ============================================================================

export interface OSHealthSummary {
  systemHealthScore: number; // 0-100
  risks: OSRisk[];
  opportunities: OSOpportunity[];
  clusters: OSCluster[];
  warnings: string[];
  metrics: OSMetrics;
  generatedAt: string;
}

export interface OSRisk {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  companies: string[]; // company IDs
  companyNames: string[];
  category: OSRiskCategory;
}

export type OSRiskCategory =
  | 'health'
  | 'diagnostics'
  | 'work'
  | 'analytics'
  | 'engagement'
  | 'pipeline'
  | 'owner';

export interface OSOpportunity {
  id: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  companies: string[];
  companyNames: string[];
  category: OSOpportunityCategory;
  actionUrl?: string;
}

export type OSOpportunityCategory =
  | 'upsell'
  | 'engagement'
  | 'diagnostics'
  | 'analytics'
  | 'content'
  | 'growth';

export interface OSCluster {
  id: string;
  clusterName: string;
  description: string;
  companies: string[];
  companyNames: string[];
  symptom: string;
  suggestedAction: string;
}

export interface OSMetrics {
  // Company metrics
  totalCompanies: number;
  companiesWithDiagnostics: number;
  companiesWithPlans: number;
  companiesAtRisk: number;
  companiesByStage: Record<string, number>;

  // Coverage percentages
  diagnosticsCoverage: number; // 0-100
  plansCoverage: number; // 0-100
  analyticsCoverage: number; // 0-100

  // Work metrics
  workCreated30d: number;
  workCompleted30d: number;
  workCompletionRate: number; // 0-100
  workOverdue: number;

  // Engagement metrics
  companiesActiveLastWeek: number;
  companiesInactiveOver14d: number;
  companiesInactiveOver30d: number;

  // DMA Funnel
  dmaAuditsStarted30d: number;
  dmaAuditsCompleted30d: number;
  dmaCompletionRate: number; // 0-100
  dmaLeads30d: number;

  // Pipeline
  newLeads30d: number;
  activeOpportunities: number;

  // Analytics
  avgGapScore: number | null;
  companiesWithGa4: number;
  companiesWithGsc: number;
}

// ============================================================================
// AI Analysis Types
// ============================================================================

export interface SystemAIAnalysis {
  nextBestAction: NextBestAction;
  systemOpportunities: string[];
  systemRisks: string[];
  executiveSummary: string;
}

export interface NextBestAction {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string;
  companyId?: string;
  companyName?: string;
}

// ============================================================================
// Daily Briefing Types
// ============================================================================

export interface DailyBriefing {
  generatedAt: string;
  overnightSummary: OvernightSummary;
  focusPlan: DailyFocusPlan;
  priorityQueue: PriorityCompanyItem[];
  diagnosticReviewQueue: DiagnosticReviewItem[];
  yesterdayActivity: YesterdayActivity;
  ownerIssues: OwnerIssue[];
}

export interface OvernightSummary {
  headline: string;
  highlights: string[];
  newWorkCreated: number;
  workCompleted: number;
  ga4Shifts: string[];
  gscSignals: string[];
  diagnosticsRun: number;
  atRiskChanges: string[];
  newOpportunities: number;
}

export interface DailyFocusPlan {
  keyActions: FocusItem[];
  quickWins: FocusItem[];
  risks: FocusItem[];
  outreachTasks: FocusItem[];
}

export interface FocusItem {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  companyId?: string;
  companyName?: string;
  linkType: 'company' | 'work' | 'analytics' | 'diagnostic' | 'none';
  linkHref?: string;
}

export interface PriorityCompanyItem {
  companyId: string;
  companyName: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  lastActivity?: string;
  issues: string[];
}

export interface DiagnosticReviewItem {
  id: string;
  companyId: string;
  companyName: string;
  toolName: string;
  score?: number;
  createdAt: string;
  status: string;
}

export interface YesterdayActivity {
  workCreated: number;
  workCompleted: number;
  diagnosticsRun: number;
  plansGenerated: number;
  notesAdded: number;
  opportunitiesCreated: number;
}

export interface OwnerIssue {
  type: 'no_owner' | 'no_strategist' | 'stalled' | 'old_plan';
  companyId: string;
  companyName: string;
  description: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface IntelligenceCache {
  osHealth: {
    data: OSHealthSummary | null;
    timestamp: number;
    ttlMs: number;
  };
  dailyBriefing: {
    data: DailyBriefing | null;
    timestamp: number;
    ttlMs: number;
  };
}
