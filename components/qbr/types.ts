// components/qbr/types.ts
// Shared types for QBR components

export interface QBRNarrativeSection {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  content: string;
  bullets?: string[];
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
  order: number;
}

export interface CrossLinkBadge {
  type: 'finding' | 'work' | 'diagnostic';
  id: string;
  label: string;
  href: string;
}

export interface NarrativeItem {
  title: string;
  description?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  area?: string;
  crossLinks?: CrossLinkBadge[];
}

export interface ThemeDeepDive {
  theme: string;
  summary: string;
  findings: NarrativeItem[];
  workItems: NarrativeItem[];
  recommendations: string[];
}

export interface SequencedRecommendation {
  tier: 'immediate' | 'short-term' | 'mid-term';
  tierLabel: string;
  recommendations: string[];
}

export interface DiagnosticTrend {
  toolId: string;
  label: string;
  currentScore: number | null;
  previousScore: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat' | 'new';
}

export interface QuarterChange {
  metric: string;
  previousValue: string | number | null;
  currentValue: string | number | null;
  delta: number | null;
  deltaPercent: number | null;
  trend: 'up' | 'down' | 'flat' | 'new';
  significance: 'major' | 'minor' | 'neutral';
  narrative: string;
}

export interface QuarterChangesSection {
  quarterLabel: string;
  previousQuarterLabel: string;
  changes: QuarterChange[];
  summaryNarrative: string;
  overallTrend: 'improving' | 'declining' | 'stable' | 'new';
}

export interface QBRNarrative {
  companyName: string;
  quarterLabel: string;
  healthScore: number;
  sections: QBRNarrativeSection[];
  executiveSummary?: QBRNarrativeSection;
  keyWins?: QBRNarrativeSection;
  keyChallenges?: QBRNarrativeSection;
  nextQuarterFocus?: QBRNarrativeSection;
  themeDeepDives?: ThemeDeepDive[];
  sequencedRecommendations?: SequencedRecommendation[];
  diagnosticTrends?: DiagnosticTrend[];
  quarterChanges?: QuarterChangesSection | null;
  fullNarrativeText?: string;
  generatedAt: string;
  aiGenerated: boolean;
  warnings: string[];
}

export interface QBRSummary {
  healthScore: number;
  diagnosticsScore: number | null;
  contextScore: number | null;
  activeWorkItems: number;
  unresolvedFindings: number;
  lastDiagnosticRun: string | null;
}
