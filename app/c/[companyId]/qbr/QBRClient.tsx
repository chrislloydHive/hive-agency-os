'use client';

// app/c/[companyId]/qbr/QBRClient.tsx
// Quarterly Business Review Mode - Main Client Component

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { DataUnavailableBanner } from '@/components/ui/DataUnavailableBanner';
import { isContextGraphHealthy } from '@/lib/contextGraph/health';

// QBR Sections
const QBR_SECTIONS = [
  'executive-summary',
  'media-performance',
  'audience-updates',
  'website-review',
  'strategy-adjustments',
  'recommendations',
  'action-items',
] as const;

type QBRSectionId = typeof QBR_SECTIONS[number];

interface QBRSection {
  id: QBRSectionId;
  label: string;
  description: string;
  icon: string;
}

const QBR_SECTION_CONFIG: Record<QBRSectionId, QBRSection> = {
  'executive-summary': {
    id: 'executive-summary',
    label: 'Executive Summary',
    description: 'High-level performance overview',
    icon: 'chart-bar',
  },
  'media-performance': {
    id: 'media-performance',
    label: 'Media Performance',
    description: 'Channel and campaign analysis',
    icon: 'trending-up',
  },
  'audience-updates': {
    id: 'audience-updates',
    label: 'Audience Updates',
    description: 'Persona and segment changes',
    icon: 'users',
  },
  'website-review': {
    id: 'website-review',
    label: 'Website Review',
    description: 'Conversion and UX analysis',
    icon: 'globe',
  },
  'strategy-adjustments': {
    id: 'strategy-adjustments',
    label: 'Strategy Adjustments',
    description: 'Recommended strategy changes',
    icon: 'adjustments',
  },
  'recommendations': {
    id: 'recommendations',
    label: 'Recommendations',
    description: 'AI-powered recommendations',
    icon: 'lightbulb',
  },
  'action-items': {
    id: 'action-items',
    label: 'Action Items',
    description: 'Next steps and work items',
    icon: 'clipboard-check',
  },
};

interface QBRClientProps {
  companyId: string;
  companyName: string;
  initialGraph: CompanyContextGraph | null;
}

export function QBRClient({
  companyId,
  companyName,
  initialGraph,
}: QBRClientProps) {
  const [currentSection, setCurrentSection] = useState<QBRSectionId>('executive-summary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [acceptedRecommendations, setAcceptedRecommendations] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Check graph health
  const graphHealthy = isContextGraphHealthy(initialGraph);

  // Log QBR started event on mount
  useEffect(() => {
    // Fire and forget - don't block on telemetry
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'qbr_started',
        companyId,
        metadata: { quarter: getCurrentQuarter() },
      }),
    }).catch(() => {}); // Silently ignore telemetry errors
  }, [companyId]);

  // Generate AI content for a section
  const generateSection = useCallback(async (sectionId: QBRSectionId) => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const response = await fetch(`/api/qbr/${companyId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: sectionId }),
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedContent((prev) => ({
          ...prev,
          [sectionId]: data.content,
        }));

        // Log section generated event
        fetch('/api/telemetry/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'qbr_section_generated',
            companyId,
            metadata: { section: sectionId },
          }),
        }).catch(() => {});
      } else {
        const errorData = await response.json().catch(() => ({}));
        setGenerateError(errorData.error || 'Failed to generate content. Please try again.');

        // Log AI error
        fetch('/api/telemetry/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ai_error',
            companyId,
            metadata: { section: sectionId, error: errorData.error },
          }),
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to generate section:', error);
      setGenerateError("We couldn't generate this automatically. You can add or edit it manually.");
    } finally {
      setIsGenerating(false);
    }
  }, [companyId]);

  // Accept a recommendation (creates a work item)
  const acceptRecommendation = useCallback(async (recommendation: string) => {
    try {
      const response = await fetch('/api/os/work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          title: recommendation,
          source: { sourceType: 'qbr_recommendation' },
          status: 'Planned',
          severity: 'Medium',
        }),
      });

      if (response.ok) {
        setAcceptedRecommendations((prev) => [...prev, recommendation]);
      }
    } catch (error) {
      console.error('Failed to create work item:', error);
    }
  }, [companyId]);

  // Export QBR Pack
  const exportQBR = useCallback(async () => {
    try {
      const response = await fetch(`/api/export/qbr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          sections: generatedContent,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qbr-${companyId}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export QBR:', error);
    }
  }, [companyId, generatedContent]);

  const sectionConfig = QBR_SECTION_CONFIG[currentSection];

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Left Sidebar */}
      <nav className="w-64 bg-slate-900 border-r border-slate-800 p-4">
        <div className="mb-6">
          <Link
            href={`/c/${companyId}`}
            className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            ← Back to Overview
          </Link>
          <h1 className="text-lg font-semibold text-slate-100 mt-3">
            Quarterly Business Review
          </h1>
          <p className="text-sm text-slate-500 mt-1">{companyName}</p>
        </div>

        <div className="space-y-1">
          {QBR_SECTIONS.map((sectionId, index) => {
            const section = QBR_SECTION_CONFIG[sectionId];
            const isActive = currentSection === sectionId;
            const hasContent = !!generatedContent[sectionId];

            return (
              <button
                key={sectionId}
                onClick={() => setCurrentSection(sectionId)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-3 ${
                  isActive
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${
                  hasContent
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-700 text-slate-500'
                }`}>
                  {index + 1}
                </span>
                <span className="text-sm">{section.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800">
          <button
            onClick={exportQBR}
            className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Export QBR Pack
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Context Health Banner */}
          {!graphHealthy && (
            <DataUnavailableBanner
              title="Context data is unavailable or incomplete"
              description="You can still proceed with the QBR, but some insights may be limited. Run Strategic Setup or diagnostics to populate the context graph."
              variant="warning"
              className="mb-6"
            />
          )}

          {/* Generation Error Banner */}
          {generateError && (
            <DataUnavailableBanner
              title="Generation failed"
              description={generateError}
              variant="error"
              className="mb-6"
            />
          )}

          {/* Section Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-slate-100">
              {sectionConfig.label}
            </h2>
            <p className="text-slate-500 mt-1">{sectionConfig.description}</p>
          </div>

          {/* Section Content */}
          <div className="space-y-6">
            {currentSection === 'executive-summary' && (
              <ExecutiveSummarySection
                graph={initialGraph}
                content={generatedContent['executive-summary']}
                onGenerate={() => generateSection('executive-summary')}
                isGenerating={isGenerating}
              />
            )}

            {currentSection === 'media-performance' && (
              <MediaPerformanceSection
                companyId={companyId}
                graph={initialGraph}
                content={generatedContent['media-performance']}
                onGenerate={() => generateSection('media-performance')}
                isGenerating={isGenerating}
              />
            )}

            {currentSection === 'audience-updates' && (
              <AudienceUpdatesSection
                graph={initialGraph}
                content={generatedContent['audience-updates']}
                onGenerate={() => generateSection('audience-updates')}
                isGenerating={isGenerating}
              />
            )}

            {currentSection === 'website-review' && (
              <WebsiteReviewSection
                graph={initialGraph}
                content={generatedContent['website-review']}
                onGenerate={() => generateSection('website-review')}
                isGenerating={isGenerating}
              />
            )}

            {currentSection === 'strategy-adjustments' && (
              <StrategyAdjustmentsSection
                graph={initialGraph}
                content={generatedContent['strategy-adjustments']}
                onGenerate={() => generateSection('strategy-adjustments')}
                isGenerating={isGenerating}
              />
            )}

            {currentSection === 'recommendations' && (
              <RecommendationsSection
                graph={initialGraph}
                content={generatedContent['recommendations']}
                onGenerate={() => generateSection('recommendations')}
                isGenerating={isGenerating}
                acceptedRecommendations={acceptedRecommendations}
                onAccept={acceptRecommendation}
              />
            )}

            {currentSection === 'action-items' && (
              <ActionItemsSection
                companyId={companyId}
                acceptedRecommendations={acceptedRecommendations}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Section Components

interface SectionProps {
  graph: CompanyContextGraph | null;
  content?: string;
  onGenerate: () => void;
  isGenerating: boolean;
}

function ExecutiveSummarySection({ graph, content, onGenerate, isGenerating }: SectionProps) {
  const objective = graph?.objectives.primaryObjective.value || 'Growth';
  const channels = graph?.performanceMedia.activeChannels.value || [];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Primary Objective" value={objective} />
        <StatCard label="Active Channels" value={channels.length.toString()} />
        <StatCard label="Graph Health" value={`${graph?.meta.completenessScore || 0}%`} />
        <StatCard label="Last Updated" value={formatDate(graph?.meta.updatedAt)} />
      </div>

      {/* Generated Summary */}
      <GeneratedContentBox
        title="Executive Summary"
        content={content}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        placeholder="Generate an AI-powered executive summary based on the current context graph and performance data."
      />
    </div>
  );
}

function MediaPerformanceSection({ companyId, graph, content, onGenerate, isGenerating }: SectionProps & { companyId: string }) {
  const channels = graph?.performanceMedia.activeChannels.value || [];
  const budget = graph?.budgetOps.totalMarketingBudget.value;

  return (
    <div className="space-y-6">
      {/* Channel Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-medium text-slate-200 mb-4">Active Channels</h3>
        <div className="flex flex-wrap gap-2">
          {channels.map((channel) => (
            <span
              key={channel}
              className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm"
            >
              {channel}
            </span>
          ))}
          {channels.length === 0 && (
            <span className="text-slate-500">No channels configured</span>
          )}
        </div>
        {budget && (
          <p className="mt-4 text-sm text-slate-400">
            Total Budget: ${budget.toLocaleString()}
          </p>
        )}
      </div>

      {/* Link to Media Lab */}
      <div className="flex gap-4">
        <Link
          href={`/c/${companyId}/diagnostics/media`}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
        >
          Open Media Lab →
        </Link>
      </div>

      {/* Generated Analysis */}
      <GeneratedContentBox
        title="Performance Analysis"
        content={content}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        placeholder="Generate media performance analysis comparing current results to objectives."
      />
    </div>
  );
}

function AudienceUpdatesSection({ graph, content, onGenerate, isGenerating }: SectionProps) {
  const segments = graph?.audience.coreSegments.value || [];
  const personaCount = graph?.audience.personaNames.value?.length || 0;

  return (
    <div className="space-y-6">
      {/* Segment Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-medium text-slate-200 mb-4">Audience Segments</h3>
        <div className="space-y-2">
          {segments.map((segment, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-slate-300">{segment}</span>
            </div>
          ))}
          {segments.length === 0 && (
            <span className="text-slate-500">No segments defined</span>
          )}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          {personaCount} personas configured
        </p>
      </div>

      <GeneratedContentBox
        title="Audience Changes"
        content={content}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        placeholder="Generate analysis of audience and persona changes since last review."
      />
    </div>
  );
}

function WebsiteReviewSection({ graph, content, onGenerate, isGenerating }: SectionProps) {
  const issues = graph?.website.criticalIssues.value || [];
  const quickWins = graph?.website.quickWins.value || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Issues */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="font-medium text-slate-200 mb-4">Critical Issues</h3>
          <ul className="space-y-2">
            {issues.slice(0, 5).map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-red-400">•</span>
                <span className="text-slate-400">{issue}</span>
              </li>
            ))}
            {issues.length === 0 && (
              <span className="text-slate-500">No critical issues</span>
            )}
          </ul>
        </div>

        {/* Quick Wins */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="font-medium text-slate-200 mb-4">Quick Wins</h3>
          <ul className="space-y-2">
            {quickWins.slice(0, 5).map((win, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-green-400">•</span>
                <span className="text-slate-400">{win}</span>
              </li>
            ))}
            {quickWins.length === 0 && (
              <span className="text-slate-500">No quick wins identified</span>
            )}
          </ul>
        </div>
      </div>

      <GeneratedContentBox
        title="Conversion Analysis"
        content={content}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        placeholder="Generate website and conversion funnel analysis with recommendations."
      />
    </div>
  );
}

function StrategyAdjustmentsSection({ graph, content, onGenerate, isGenerating }: SectionProps) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-medium text-slate-200 mb-4">Current Strategy</h3>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-slate-500">Primary Objective</span>
            <p className="text-slate-300">{graph?.objectives.primaryObjective.value || 'Not set'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Time Horizon</span>
            <p className="text-slate-300">{graph?.objectives.timeHorizon.value || 'Not set'}</p>
          </div>
        </div>
      </div>

      <GeneratedContentBox
        title="Strategy Recommendations"
        content={content}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        placeholder="Generate AI recommendations for strategy adjustments based on performance data."
      />
    </div>
  );
}

interface RecommendationsSectionProps extends SectionProps {
  acceptedRecommendations: string[];
  onAccept: (recommendation: string) => void;
}

function RecommendationsSection({
  content,
  onGenerate,
  isGenerating,
  acceptedRecommendations,
  onAccept,
}: RecommendationsSectionProps) {
  // Parse recommendations from content
  const recommendations = content
    ? content.split('\n').filter((line) => line.startsWith('- ') || line.startsWith('• '))
    : [];

  return (
    <div className="space-y-6">
      <GeneratedContentBox
        title="AI Recommendations"
        content={content}
        onGenerate={onGenerate}
        isGenerating={isGenerating}
        placeholder="Generate prioritized recommendations based on all QBR data."
      />

      {recommendations.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="font-medium text-slate-200 mb-4">Accept Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((rec, i) => {
              const cleanRec = rec.replace(/^[-•]\s*/, '');
              const isAccepted = acceptedRecommendations.includes(cleanRec);

              return (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <span className="text-sm text-slate-300">{cleanRec}</span>
                  <button
                    onClick={() => onAccept(cleanRec)}
                    disabled={isAccepted}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      isAccepted
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                    }`}
                  >
                    {isAccepted ? 'Added' : 'Add to Work'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ActionItemsSectionProps {
  companyId: string;
  acceptedRecommendations: string[];
}

function ActionItemsSection({ companyId, acceptedRecommendations }: ActionItemsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-medium text-slate-200 mb-4">
          Action Items from This QBR ({acceptedRecommendations.length})
        </h3>

        {acceptedRecommendations.length > 0 ? (
          <ul className="space-y-2">
            {acceptedRecommendations.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-slate-300">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">
            No action items created yet. Accept recommendations to add them as work items.
          </p>
        )}
      </div>

      <Link
        href={`/c/${companyId}/work`}
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
      >
        View All Work Items →
      </Link>
    </div>
  );
}

// Helper Components

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-slate-200">{value}</div>
    </div>
  );
}

interface GeneratedContentBoxProps {
  title: string;
  content?: string;
  onGenerate: () => void;
  isGenerating: boolean;
  placeholder: string;
}

function GeneratedContentBox({
  title,
  content,
  onGenerate,
  isGenerating,
  placeholder,
}: GeneratedContentBoxProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-slate-200">{title}</h3>
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : content ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {content ? (
        <div className="prose prose-invert prose-sm max-w-none">
          <div className="whitespace-pre-wrap text-slate-300">{content}</div>
        </div>
      ) : (
        <p className="text-slate-500 italic">{placeholder}</p>
      )}
    </div>
  );
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return 'Never';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Invalid';
  }
}

function getCurrentQuarter(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter}-${now.getFullYear()}`;
}
