'use client';

// app/c/[companyId]/reports/qbr/QBRReportClient.tsx
// QBR Report Client - Story View V2
// A polished narrative document view with cohesive visual language

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Clock,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Target,
  ChevronRight,
  Activity,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import type { CompanyReport } from '@/lib/reports/types';

// Import new Story View components
import { QBRStoryHeader } from '@/components/reports/QBRStoryHeader';
import { QBRScoreStrip } from '@/components/reports/QBRScoreStrip';
import { QBRHighlightsGrid } from '@/components/reports/QBRHighlightsGrid';
import { QBRStorySection, StorySectionBulletList } from '@/components/reports/QBRStorySection';
import { QBRJumpNav, QBRJumpNavMobile } from '@/components/reports/QBRJumpNav';
import { HealthScoreRing } from '@/components/qbr/HealthScoreRing';
import { TrendIndicator } from '@/components/qbr/TrendIndicator';
import { QBREmptyState, getQBREmptyStateReason } from '@/components/qbr/QBREmptyState';

// ============================================================================
// Types
// ============================================================================

interface QBRNarrativeSection {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  content: string;
  bullets?: string[];
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
  order: number;
}

interface CrossLinkBadge {
  type: 'finding' | 'work' | 'diagnostic';
  id: string;
  label: string;
  href: string;
}

interface NarrativeItem {
  title: string;
  description?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  area?: string;
  crossLinks?: CrossLinkBadge[];
}

interface ThemeDeepDive {
  theme: string;
  summary: string;
  findings: NarrativeItem[];
  workItems: NarrativeItem[];
  recommendations: string[];
}

interface SequencedRecommendation {
  tier: 'immediate' | 'short-term' | 'mid-term';
  tierLabel: string;
  recommendations: string[];
}

interface DiagnosticTrend {
  toolId: string;
  label: string;
  currentScore: number | null;
  previousScore: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat' | 'new';
}

interface QBRNarrative {
  companyName: string;
  quarterLabel: string;
  healthScore: number;
  sections: QBRNarrativeSection[];
  keyWins?: QBRNarrativeSection;
  keyChallenges?: QBRNarrativeSection;
  nextQuarterFocus?: QBRNarrativeSection;
  themeDeepDives?: ThemeDeepDive[];
  sequencedRecommendations?: SequencedRecommendation[];
  diagnosticTrends?: DiagnosticTrend[];
  generatedAt: string;
  aiGenerated: boolean;
  warnings: string[];
}

interface QBRSummary {
  healthScore: number;
  diagnosticsScore: number | null;
  contextScore: number | null;
  activeWorkItems: number;
  unresolvedFindings: number;
  lastDiagnosticRun: string | null;
  diagnosticModulesCount?: number;
  workConversionRate?: number;
}

interface QBRAPIResponse {
  success: boolean;
  narrative?: QBRNarrative;
  summary?: QBRSummary;
}

interface Props {
  companyId: string;
  companyName: string;
  period: string;
  existingReport: CompanyReport | null;
}

// ============================================================================
// Helper Components
// ============================================================================

// Cross-link badge
function CrossLinkBadgeComponent({ badge }: { badge: CrossLinkBadge }) {
  const colors = {
    finding: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    work: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    diagnostic: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  };

  return (
    <Link
      href={badge.href}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${colors[badge.type]} hover:opacity-80 transition-opacity`}
    >
      <ExternalLink className="w-2.5 h-2.5" />
      {badge.label}
    </Link>
  );
}

// Severity badge
function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' }) {
  const colors = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-amber-500/20 text-amber-400',
    medium: 'bg-blue-500/20 text-blue-400',
    low: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[severity]}`}>
      {severity}
    </span>
  );
}

// ============================================================================
// Section Content Components
// ============================================================================

// Executive Summary Content
function ExecutiveSummaryContent({
  section,
  summary,
  companyId,
}: {
  section?: QBRNarrativeSection;
  summary: QBRSummary | null;
  companyId: string;
}) {
  return (
    <div className="space-y-4">
      {/* Health Score Hero */}
      {summary && (
        <div className="flex items-center gap-6 p-4 rounded-lg bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50">
          <HealthScoreRing score={summary.healthScore} size="large" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">Marketing Health Score</h3>
            <p className="text-sm text-slate-400 mt-1">
              {summary.healthScore >= 80 ? 'Excellent - marketing operations are performing well' :
               summary.healthScore >= 60 ? 'Good - with opportunities for improvement' :
               summary.healthScore >= 40 ? 'Needs attention - focus on key areas' :
               'Critical - significant work needed'}
            </p>
          </div>
          <div className="hidden sm:grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{summary.diagnosticsScore ?? '--'}<span className="text-xs text-slate-400">%</span></div>
              <div className="text-[10px] text-slate-500">Diagnostics</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{summary.activeWorkItems}</div>
              <div className="text-[10px] text-slate-500">Active Work</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-slate-100">{summary.unresolvedFindings}</div>
              <div className="text-[10px] text-slate-500">Findings</div>
            </div>
          </div>
        </div>
      )}

      {/* Narrative content */}
      {section && (
        <>
          <p className="text-sm text-slate-300 leading-relaxed">{section.content}</p>
          {section.bullets && section.bullets.length > 0 && (
            <StorySectionBulletList bullets={section.bullets} />
          )}
        </>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link href={`/c/${companyId}/plan`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
          <Target className="w-3.5 h-3.5 text-blue-400" /> Plan
        </Link>
        <Link href={`/c/${companyId}/work`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
          <ClipboardList className="w-3.5 h-3.5 text-emerald-400" /> Work
        </Link>
        <Link href={`/c/${companyId}/diagnostics`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
          <Activity className="w-3.5 h-3.5 text-purple-400" /> Diagnostics
        </Link>
      </div>
    </div>
  );
}

// Performance Overview Content
function PerformanceOverviewContent({
  section,
  trends,
  companyId,
}: {
  section?: QBRNarrativeSection;
  trends?: DiagnosticTrend[];
  companyId: string;
}) {
  return (
    <div className="space-y-4">
      {section && <p className="text-sm text-slate-300 leading-relaxed">{section.content}</p>}

      {/* Trends grid */}
      {trends && trends.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {trends.map((trend) => (
            <Link
              key={trend.toolId}
              href={`/c/${companyId}/diagnostics/${trend.toolId.replace('Lab', '-lab')}`}
              className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{trend.label}</span>
                <TrendIndicator trend={trend.trend} delta={trend.delta} />
              </div>
              <div className="text-2xl font-bold tabular-nums text-slate-100">
                {trend.currentScore ?? '--'}
                <span className="text-sm text-slate-500">%</span>
              </div>
              {trend.previousScore !== null && (
                <div className="text-[10px] text-slate-500 mt-1">
                  Previous: {trend.previousScore}%
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {section?.bullets && section.bullets.length > 0 && (
        <StorySectionBulletList bullets={section.bullets} />
      )}
    </div>
  );
}

// Key Wins/Challenges Content
function WinsChallengesContent({
  section,
  type,
}: {
  section?: QBRNarrativeSection;
  type: 'wins' | 'challenges';
}) {
  if (!section) return null;

  const Icon = type === 'wins' ? CheckCircle2 : AlertTriangle;
  const iconColor = type === 'wins' ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-300">{section.content}</p>
      {section.bullets && section.bullets.length > 0 && (
        <StorySectionBulletList
          bullets={section.bullets}
          icon={Icon}
          iconColor={iconColor}
        />
      )}
    </div>
  );
}

// Theme Deep Dives Content
function ThemeDeepDivesContent({
  themes,
  companyId: _companyId,
}: {
  themes?: ThemeDeepDive[];
  companyId: string;
}) {
  if (!themes || themes.length === 0) {
    return <p className="text-sm text-slate-400 italic">No theme deep dives available.</p>;
  }

  return (
    <div className="space-y-4">
      {themes.map((theme, idx) => (
        <div key={idx} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <h4 className="font-medium text-slate-100 mb-2">{theme.theme}</h4>
          <p className="text-xs text-slate-400 mb-3">{theme.summary}</p>

          {/* Findings */}
          {theme.findings.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Findings</p>
              <div className="space-y-2">
                {theme.findings.slice(0, 3).map((finding, fidx) => (
                  <div key={fidx} className="flex items-start gap-2">
                    {finding.severity && <SeverityBadge severity={finding.severity} />}
                    <span className="text-xs text-slate-300">{finding.title}</span>
                    {finding.crossLinks?.map((link, lidx) => (
                      <CrossLinkBadgeComponent key={lidx} badge={link} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work Items */}
          {theme.workItems.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Related Work</p>
              <div className="space-y-2">
                {theme.workItems.map((work, widx) => (
                  <div key={widx} className="flex items-start gap-2">
                    <ClipboardList className="w-3 h-3 text-emerald-400 mt-0.5" />
                    <span className="text-xs text-slate-300">{work.title}</span>
                    {work.crossLinks?.map((link, lidx) => (
                      <CrossLinkBadgeComponent key={lidx} badge={link} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {theme.recommendations.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Recommendations</p>
              <ul className="space-y-1">
                {theme.recommendations.map((rec, ridx) => (
                  <li key={ridx} className="flex items-start gap-2 text-xs text-slate-400">
                    <ChevronRight className="w-3 h-3 mt-0.5 text-slate-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Sequenced Recommendations Content
function SequencedRecommendationsContent({
  recommendations,
}: {
  recommendations?: SequencedRecommendation[];
}) {
  if (!recommendations || recommendations.length === 0) {
    return <p className="text-sm text-slate-400 italic">No recommendations available.</p>;
  }

  const tierColors = {
    immediate: 'border-red-500/30 bg-red-500/5',
    'short-term': 'border-amber-500/30 bg-amber-500/5',
    'mid-term': 'border-blue-500/30 bg-blue-500/5',
  };

  const tierIcons = {
    immediate: <AlertCircle className="w-4 h-4 text-red-400" />,
    'short-term': <Clock className="w-4 h-4 text-amber-400" />,
    'mid-term': <Target className="w-4 h-4 text-blue-400" />,
  };

  return (
    <div className="space-y-4">
      {recommendations.map((tier, idx) => (
        <div key={idx} className={`p-4 rounded-lg border ${tierColors[tier.tier]}`}>
          <div className="flex items-center gap-2 mb-3">
            {tierIcons[tier.tier]}
            <h4 className="text-sm font-medium text-slate-100">{tier.tierLabel}</h4>
          </div>
          <ol className="space-y-2">
            {tier.recommendations.map((rec, ridx) => (
              <li key={ridx} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-800 text-xs text-slate-400 flex-shrink-0">
                  {ridx + 1}
                </span>
                {rec}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function QBRReportClient({
  companyId,
  companyName,
  period,
}: Props) {
  const [narrative, setNarrative] = useState<QBRNarrative | null>(null);
  const [summary, setSummary] = useState<QBRSummary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/os/companies/${companyId}/qbr?summary=true`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSummary({
              healthScore: data.healthScore,
              diagnosticsScore: data.diagnosticsScore,
              contextScore: data.contextScore,
              activeWorkItems: data.activeWorkItems,
              unresolvedFindings: data.unresolvedFindings,
              lastDiagnosticRun: data.lastDiagnosticRun,
              diagnosticModulesCount: data.diagnosticModulesCount,
              workConversionRate: data.workConversionRate,
            });
          }
        }
      } catch (err) {
        console.error('Failed to load QBR summary:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [companyId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/qbr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quarter: period, useAI: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate QBR');
      }

      const data: QBRAPIResponse = await response.json();
      if (data.narrative) {
        setNarrative(data.narrative);
      }
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Failed to generate QBR:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate QBR');
    } finally {
      setGenerating(false);
    }
  };

  // Find sections by type
  const executiveSummary = narrative?.sections.find(s => s.type === 'summary');
  const diagnosticsSection = narrative?.sections.find(s => s.type === 'diagnostics');

  // Prepare summary for components
  const displaySummary = summary || (narrative ? {
    healthScore: narrative.healthScore,
    diagnosticsScore: null,
    contextScore: null,
    activeWorkItems: 0,
    unresolvedFindings: 0,
    lastDiagnosticRun: null,
  } : null);

  // Build sections for jump nav
  const jumpNavSections = [
    { id: 'exec', label: 'Executive Summary' },
    { id: 'performance', label: 'Performance' },
    ...(narrative?.keyWins ? [{ id: 'key-wins', label: 'Key Wins' }] : []),
    { id: 'challenges', label: 'Challenges' },
    { id: 'next-quarter', label: 'Next Quarter' },
    ...(narrative?.themeDeepDives?.length ? [{ id: 'deep-dives', label: 'Deep Dives' }] : []),
    { id: 'recommendations', label: 'Recommendations' },
  ];

  return (
    <div className="space-y-6">
      {/* Story Header */}
      <QBRStoryHeader
        companyId={companyId}
        companyName={companyName}
        periodLabel={period}
        healthScore={displaySummary?.healthScore ?? 0}
        generatedAt={narrative?.generatedAt}
        aiGenerated={narrative?.aiGenerated}
        generating={generating}
        onRegenerate={handleGenerate}
        hasNarrative={!!narrative}
      />

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      {narrative ? (
        <>
          {/* Score Strip */}
          <QBRScoreStrip
            healthScore={displaySummary?.healthScore ?? narrative.healthScore}
            diagnosticsScore={displaySummary?.diagnosticsScore ?? null}
            contextScore={displaySummary?.contextScore ?? null}
            activeWorkItems={displaySummary?.activeWorkItems ?? 0}
            unresolvedFindings={displaySummary?.unresolvedFindings ?? 0}
            diagnosticModulesCount={displaySummary?.diagnosticModulesCount}
            workConversionRate={displaySummary?.workConversionRate}
          />

          {/* Highlights Grid */}
          <QBRHighlightsGrid
            keyWins={narrative.keyWins}
            keyChallenges={narrative.keyChallenges}
            nextQuarterFocus={narrative.nextQuarterFocus}
            themeDeepDives={narrative.themeDeepDives}
          />

          {/* Mobile Jump Nav */}
          <QBRJumpNavMobile sections={jumpNavSections} />

          {/* Main Content Layout */}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-6">
            {/* Story Sections */}
            <main className="space-y-4">
              {/* Executive Summary */}
              <QBRStorySection
                id="exec"
                title="Executive Summary"
                eyebrow="1. Overview"
                pill={narrative.aiGenerated ? 'AI Enhanced' : undefined}
                pillColor="purple"
              >
                <ExecutiveSummaryContent
                  section={executiveSummary}
                  summary={displaySummary}
                  companyId={companyId}
                />
              </QBRStorySection>

              {/* Performance Overview */}
              <QBRStorySection
                id="performance"
                title="Performance Overview"
                eyebrow="2. Diagnostics"
              >
                <PerformanceOverviewContent
                  section={diagnosticsSection}
                  trends={narrative.diagnosticTrends}
                  companyId={companyId}
                />
              </QBRStorySection>

              {/* Key Wins */}
              {narrative.keyWins && (
                <QBRStorySection
                  id="key-wins"
                  title={narrative.keyWins.title}
                  eyebrow="3. Wins"
                  pill={narrative.keyWins.tone === 'positive' ? 'Strong' : undefined}
                  pillColor="emerald"
                >
                  <WinsChallengesContent section={narrative.keyWins} type="wins" />
                </QBRStorySection>
              )}

              {/* Key Challenges */}
              <QBRStorySection
                id="challenges"
                title={narrative.keyChallenges?.title || 'Key Challenges'}
                eyebrow="4. Challenges"
                pill={
                  narrative.keyChallenges?.tone === 'critical' ? 'Critical' :
                  narrative.keyChallenges?.tone === 'warning' ? 'Needs Focus' : undefined
                }
                pillColor={narrative.keyChallenges?.tone === 'critical' ? 'red' : 'amber'}
              >
                <WinsChallengesContent section={narrative.keyChallenges} type="challenges" />
              </QBRStorySection>

              {/* Next Quarter Focus */}
              <QBRStorySection
                id="next-quarter"
                title={narrative.nextQuarterFocus?.title || 'Next Quarter Focus'}
                eyebrow="5. Planning"
              >
                {narrative.nextQuarterFocus ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">{narrative.nextQuarterFocus.content}</p>
                    {narrative.nextQuarterFocus.bullets && (
                      <StorySectionBulletList
                        bullets={narrative.nextQuarterFocus.bullets}
                        icon={Target}
                        iconColor="text-cyan-400"
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Focus areas not yet defined.</p>
                )}
              </QBRStorySection>

              {/* Theme Deep Dives */}
              {narrative.themeDeepDives && narrative.themeDeepDives.length > 0 && (
                <QBRStorySection
                  id="deep-dives"
                  title="Theme Deep Dives"
                  eyebrow="6. Analysis"
                  pill={`${narrative.themeDeepDives.length} themes`}
                  pillColor="indigo"
                >
                  <ThemeDeepDivesContent
                    themes={narrative.themeDeepDives}
                    companyId={companyId}
                  />
                </QBRStorySection>
              )}

              {/* Prioritized Recommendations */}
              <QBRStorySection
                id="recommendations"
                title="Prioritized Recommendations"
                eyebrow="7. Actions"
              >
                <SequencedRecommendationsContent
                  recommendations={narrative.sequencedRecommendations}
                />
              </QBRStorySection>
            </main>

            {/* Desktop Jump Nav Sidebar */}
            <aside className="hidden lg:block">
              <QBRJumpNav sections={jumpNavSections} />
            </aside>
          </div>

          {/* Warnings */}
          {narrative.warnings && narrative.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Data Warnings</p>
                  <ul className="text-xs text-amber-300/80 mt-1 space-y-0.5">
                    {narrative.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      ) : !generating && !loading ? (
        /* Empty State */
        <QBREmptyState
          companyId={companyId}
          reason={getQBREmptyStateReason(
            summary?.diagnosticModulesCount ?? 0,
            summary?.unresolvedFindings ?? 0,
            summary?.activeWorkItems ?? 0
          )}
          diagnosticsCount={summary?.diagnosticModulesCount ?? 0}
          findingsCount={summary?.unresolvedFindings ?? 0}
          workItemsCount={summary?.activeWorkItems ?? 0}
          onGenerate={handleGenerate}
          generating={generating}
        />
      ) : generating ? (
        /* Generating State */
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-12 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-4" />
          <p className="text-sm text-slate-300">Generating your quarterly business review...</p>
          <p className="text-xs text-slate-500 mt-1">Analyzing diagnostics, work items, and findings.</p>
        </div>
      ) : (
        /* Loading State */
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-12 flex flex-col items-center justify-center">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin mb-3" />
          <p className="text-sm text-slate-400">Loading QBR data...</p>
        </div>
      )}
    </div>
  );
}
