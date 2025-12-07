'use client';

// app/c/[companyId]/labs/competitor/CompetitorLabClient.tsx
// Competitor Lab Client Component - FULLY EXPANDED
//
// Complete competitive intelligence interface with tabs:
// 1. Profiles - Competitor list with detail panel
// 2. Features Matrix - Grid view comparison
// 3. Pricing Landscape - Price vs value scatterplot
// 4. Messaging Overlap - Theme overlap visualization
// 5. Market Clusters - Positioning map with cluster overlay
// 6. Threats & Trajectory - Bar chart summaries
// 7. Substitutes - Alternative solution tracking
// 8. Refinement - Lab refinement panel

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { CompetitorLabContext } from './loadCompetitorLab';
import type {
  CompetitorProfile,
  FeatureMatrixEntry,
  PricingModel,
  MessageOverlap,
  MarketCluster,
  ThreatScore,
  Substitute,
  WhitespaceOpportunity,
} from '@/lib/contextGraph/domains/competitive';
import type { LabRefinementRunResult } from '@/lib/labs/refinementTypes';
import { RefinementSummary } from '@/components/labs/RefinementSummary';

// ============================================================================
// Types
// ============================================================================

interface CompetitorLabClientProps {
  companyId: string;
  companyName: string;
  labContext: CompetitorLabContext;
}

type TabId =
  | 'discovery'
  | 'profiles'
  | 'features'
  | 'pricing'
  | 'messaging'
  | 'clusters'
  | 'threats'
  | 'substitutes'
  | 'refinement';

// ============================================================================
// Component
// ============================================================================

// Discovery result type (from Competition Lab v2)
interface DiscoveryResult {
  runId: string;
  status: string;
  summary: {
    totalDiscovered: number;
    coreCount: number;
    secondaryCount: number;
    alternativeCount: number;
  };
  competitors: Array<{
    competitorName: string;
    competitorDomain: string;
    role: string;
    overallScore: number;
    offerSimilarity: number;
    audienceSimilarity: number;
    threatLevel: number | null;
  }>;
}

// Map V3 competitor type to V2 role
function mapV3TypeToRole(type: string | undefined): string {
  switch (type) {
    case 'direct': return 'core';
    case 'partial': return 'secondary';
    case 'fractional': return 'secondary';
    case 'platform': return 'alternative';
    case 'internal': return 'alternative';
    default: return 'secondary';
  }
}

export function CompetitorLabClient({
  companyId,
  companyName,
  labContext,
}: CompetitorLabClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('discovery');
  const [isRunning, setIsRunning] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [refinementResult, setRefinementResult] = useState<LabRefinementRunResult | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(
    labContext.competitors[0]?.name || null
  );

  // Tabs configuration
  const tabs: { id: TabId; label: string; description: string; count?: number }[] = [
    { id: 'discovery', label: 'Discovery', description: 'Run AI competitor discovery pipeline' },
    { id: 'profiles', label: 'Profiles', description: 'Manage competitor profiles', count: labContext.competitors.filter(c => c.category !== 'own').length },
    { id: 'features', label: 'Features', description: 'Feature comparison matrix', count: labContext.featuresMatrix.length },
    { id: 'pricing', label: 'Pricing', description: 'Pricing landscape analysis', count: labContext.pricingModels.length },
    { id: 'messaging', label: 'Messaging', description: 'Messaging overlap analysis', count: labContext.messageOverlap.length },
    { id: 'clusters', label: 'Clusters', description: 'Market cluster analysis', count: labContext.marketClusters.length },
    { id: 'threats', label: 'Threats', description: 'Threat & trajectory modeling', count: labContext.threatScores.length },
    { id: 'substitutes', label: 'Substitutes', description: 'Alternative solutions', count: labContext.substitutes.length },
    { id: 'refinement', label: 'Refine', description: 'Run competitive analysis' },
  ];

  // Get selected competitor
  const selectedCompetitor = useMemo(
    () => labContext.competitors.find((c) => c.name === selectedCompetitorId) || null,
    [labContext.competitors, selectedCompetitorId]
  );

  // Filter out "own" category for competitor list
  const competitors = useMemo(
    () => labContext.competitors.filter((c) => c.category !== 'own'),
    [labContext.competitors]
  );

  // Run Competitor Lab refinement
  const runRefinement = useCallback(async () => {
    setIsRunning(true);
    setRefinementResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/labs/competitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to run Competitor Lab');
        return;
      }

      setRefinementResult({
        refinement: {
          refinedContext: data.refined || [],
          diagnostics: data.diagnostics || [],
          summary: data.summary,
        },
        applyResult: data.apply || null,
        labId: 'competitor',
        companyId,
        runAt: data.runAt || new Date().toISOString(),
        durationMs: data.durationMs || 0,
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed');
    } finally {
      setIsRunning(false);
    }
  }, [companyId, router]);

  // Run Competition Discovery (Competition Lab v2)
  const runDiscovery = useCallback(async () => {
    setIsDiscovering(true);
    setDiscoveryResult(null);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/competition/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to run Competition Discovery');
        return;
      }

      // Map V3 response to V2 format expected by this component
      const mappedCompetitors = (data.competitors || []).map((c: any) => ({
        competitorName: c.name || c.competitorName || 'Unknown',
        competitorDomain: c.domain || c.competitorDomain || '',
        role: mapV3TypeToRole(c.type) || c.role || 'secondary',
        overallScore: c.threatScore || c.overallScore || 50,
        offerSimilarity: c.positioning?.x || c.offerSimilarity || 50,
        audienceSimilarity: c.positioning?.y || c.audienceSimilarity || 50,
        threatLevel: c.threatScore || c.threatLevel || null,
      }));

      setDiscoveryResult({
        runId: data.runId,
        status: data.status,
        summary: {
          totalDiscovered: data.summary?.totalCompetitors || mappedCompetitors.length,
          coreCount: data.summary?.byType?.direct || 0,
          secondaryCount: (data.summary?.byType?.partial || 0) + (data.summary?.byType?.fractional || 0),
          alternativeCount: (data.summary?.byType?.platform || 0) + (data.summary?.byType?.internal || 0),
        },
        competitors: mappedCompetitors,
      });

      // Refresh to load new data from Context Graph
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setIsDiscovering(false);
    }
  }, [companyId, router]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Competitor Lab</h1>
          <p className="mt-1 text-sm text-slate-400">
            Comprehensive competitive intelligence for {companyName}
          </p>
        </div>
        <DataQualityBadge
          confidence={labContext.dataConfidence}
          lastValidated={labContext.lastValidatedAt}
          overallThreat={labContext.overallThreatLevel}
        />
      </div>

      {/* Readiness Panel */}
      <ReadinessPanel readiness={labContext.readiness} companyId={companyId} />

      {/* Action Bar */}
      <div className="mb-6 flex items-center justify-between gap-4 rounded-lg bg-slate-900/50 border border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={runRefinement}
            disabled={isRunning}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-rose-500 text-white hover:bg-rose-400'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Spinner />
                Analyzing...
              </span>
            ) : (
              'Run Full Analysis'
            )}
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">
            {competitors.length} competitor{competitors.length !== 1 ? 's' : ''}
          </span>
          {labContext.messagingDifferentiationScore !== null && (
            <span className="text-slate-500">
              Differentiation: {labContext.messagingDifferentiationScore}/100
            </span>
          )}
          {labContext.primaryAxis && (
            <span className="text-slate-500">
              Axes: {labContext.primaryAxis} / {labContext.secondaryAxis}
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-800">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-rose-400 border-rose-400'
                  : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
              }`}
              title={tab.description}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'discovery' && (
          <DiscoveryTab
            isDiscovering={isDiscovering}
            discoveryResult={discoveryResult}
            existingCount={competitors.length}
            onRunDiscovery={runDiscovery}
            companyName={companyName}
          />
        )}

        {activeTab === 'profiles' && (
          <ProfilesTab
            competitors={competitors}
            selectedCompetitor={selectedCompetitor}
            onSelect={setSelectedCompetitorId}
          />
        )}

        {activeTab === 'features' && (
          <FeaturesMatrixTab
            featuresMatrix={labContext.featuresMatrix}
            competitors={competitors}
            companyName={companyName}
          />
        )}

        {activeTab === 'pricing' && (
          <PricingLandscapeTab
            pricingModels={labContext.pricingModels}
            ownPriceTier={labContext.ownPriceTier}
            companyName={companyName}
          />
        )}

        {activeTab === 'messaging' && (
          <MessagingOverlapTab
            messageOverlap={labContext.messageOverlap}
            differentiationScore={labContext.messagingDifferentiationScore}
          />
        )}

        {activeTab === 'clusters' && (
          <MarketClustersTab
            clusters={labContext.marketClusters}
            competitors={labContext.competitors}
            whitespaceMap={labContext.whitespaceMap}
            primaryAxis={labContext.primaryAxis}
            secondaryAxis={labContext.secondaryAxis}
            ownXPosition={labContext.ownXPosition}
            ownYPosition={labContext.ownYPosition}
            companyName={companyName}
          />
        )}

        {activeTab === 'threats' && (
          <ThreatsTrajectoryTab
            threatScores={labContext.threatScores}
            competitors={competitors}
            overallThreatLevel={labContext.overallThreatLevel}
          />
        )}

        {activeTab === 'substitutes' && (
          <SubstitutesTab substitutes={labContext.substitutes} />
        )}

        {activeTab === 'refinement' && (
          <RefinementTab
            isRunning={isRunning}
            refinementResult={refinementResult}
            onRun={runRefinement}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function DataQualityBadge({
  confidence,
  lastValidated,
  overallThreat,
}: {
  confidence: number | null;
  lastValidated: string | null;
  overallThreat: number | null;
}) {
  if (confidence === null) return null;

  const confidencePct = Math.round(confidence * 100);
  const color =
    confidencePct >= 70 ? 'text-emerald-400' : confidencePct >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex flex-col items-end">
        <span className="text-slate-500">Data Confidence</span>
        <span className={`font-medium ${color}`}>{confidencePct}%</span>
      </div>
      {overallThreat !== null && (
        <div className="flex flex-col items-end">
          <span className="text-slate-500">Threat Level</span>
          <span className={`font-medium ${overallThreat >= 60 ? 'text-red-400' : overallThreat >= 40 ? 'text-amber-400' : 'text-slate-400'}`}>
            {overallThreat}/100
          </span>
        </div>
      )}
      {lastValidated && (
        <div className="flex flex-col items-end">
          <span className="text-slate-500">Last Validated</span>
          <span className="text-slate-400">{new Date(lastValidated).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}

function ReadinessPanel({
  readiness,
  companyId,
}: {
  readiness: CompetitorLabContext['readiness'];
  companyId: string;
}) {
  if (readiness.canRunHighConfidence && readiness.recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {readiness.canRunHighConfidence ? (
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <p className={`text-sm font-medium ${readiness.canRunHighConfidence ? 'text-amber-400' : 'text-red-400'}`}>
            {readiness.canRunHighConfidence
              ? 'Low confidence mode - some context missing'
              : 'Missing critical context'}
          </p>
          {readiness.missingCritical.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              Missing: {readiness.missingCritical.join(', ')}
            </p>
          )}
          {readiness.recommendations.length > 0 && (
            <ul className="mt-2 text-xs text-slate-500 space-y-1">
              {readiness.recommendations.slice(0, 3).map((rec, i) => (
                <li key={i}>• {rec}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryChip({ category }: { category: string | null }) {
  const styles: Record<string, string> = {
    direct: 'bg-red-500/20 text-red-400',
    indirect: 'bg-blue-500/20 text-blue-400',
    aspirational: 'bg-purple-500/20 text-purple-400',
    emerging: 'bg-amber-500/20 text-amber-400',
  };

  if (!category) return null;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[category] || 'bg-slate-700 text-slate-400'}`}>
      {category}
    </span>
  );
}

function ThreatBadge({ level }: { level: number | null }) {
  if (level === null) return null;

  const color =
    level >= 70 ? 'bg-red-500/20 text-red-400' :
    level >= 50 ? 'bg-amber-500/20 text-amber-400' :
    level >= 30 ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-slate-700 text-slate-400';

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
      Threat: {level}
    </span>
  );
}

function TrajectoryBadge({ trajectory }: { trajectory: string | null }) {
  if (!trajectory) return null;

  const styles: Record<string, string> = {
    rising: 'text-red-400',
    falling: 'text-emerald-400',
    stagnant: 'text-slate-400',
  };

  const icons: Record<string, string> = {
    rising: '↗',
    falling: '↘',
    stagnant: '→',
  };

  return (
    <span className={`text-xs ${styles[trajectory] || 'text-slate-400'}`}>
      {icons[trajectory] || '→'} {trajectory}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: 'chart' | 'list' | 'grid' | 'target' | 'alert';
  title: string;
  description: string;
}) {
  const icons = {
    chart: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
    list: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    ),
    grid: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    ),
    target: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    ),
    alert: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icons[icon]}
        </svg>
      </div>
      <h3 className="text-lg font-medium text-slate-300 mb-2">{title}</h3>
      <p className="text-slate-500 max-w-md">{description}</p>
    </div>
  );
}

// ============================================================================
// Tab: Profiles
// ============================================================================

function ProfilesTab({
  competitors,
  selectedCompetitor,
  onSelect,
}: {
  competitors: CompetitorProfile[];
  selectedCompetitor: CompetitorProfile | null;
  onSelect: (name: string) => void;
}) {
  if (competitors.length === 0) {
    return (
      <EmptyState
        icon="list"
        title="No Competitors Defined"
        description="Run Competitor Lab to analyze your competitive landscape and populate competitor profiles."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Competitor List */}
      <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {competitors.map((competitor) => (
          <button
            key={competitor.name}
            onClick={() => onSelect(competitor.name)}
            className={`w-full text-left rounded-lg p-3 transition-colors ${
              selectedCompetitor?.name === competitor.name
                ? 'bg-rose-500/10 border border-rose-500/30'
                : 'bg-slate-900/50 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-100 text-sm truncate">{competitor.name}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <CategoryChip category={competitor.category} />
                <TrajectoryBadge trajectory={competitor.trajectory} />
              </div>
            </div>
            {competitor.positioning && (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{competitor.positioning}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
              {competitor.confidence !== null && competitor.confidence !== undefined && (
                <span>Confidence: {Math.round(competitor.confidence * 100)}%</span>
              )}
              {competitor.threatLevel !== null && (
                <span className={competitor.threatLevel >= 60 ? 'text-red-400' : ''}>
                  Threat: {competitor.threatLevel}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Right: Competitor Detail */}
      <div className="lg:col-span-2">
        {selectedCompetitor ? (
          <CompetitorDetail competitor={selectedCompetitor} />
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-400">Select a competitor to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CompetitorDetail({ competitor }: { competitor: CompetitorProfile }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-100">{competitor.name}</h2>
            <CategoryChip category={competitor.category} />
            <ThreatBadge level={competitor.threatLevel} />
            <TrajectoryBadge trajectory={competitor.trajectory} />
          </div>
          {competitor.domain && (
            <a
              href={`https://${competitor.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-rose-400 hover:text-rose-300"
            >
              {competitor.domain}
            </a>
          )}
        </div>
        {competitor.confidence !== null && (
          <div className="text-right">
            <span className="text-xs text-slate-500">Confidence</span>
            <p className="text-lg font-semibold text-slate-200">{Math.round(competitor.confidence * 100)}%</p>
          </div>
        )}
      </div>

      {/* Positioning */}
      {competitor.positioning && (
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Positioning</h3>
          <p className="text-sm text-slate-300">{competitor.positioning}</p>
        </div>
      )}

      {/* Trajectory Reason */}
      {competitor.trajectoryReason && (
        <div className="rounded-lg bg-slate-800/50 p-3">
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-1">Trajectory Analysis</h3>
          <p className="text-sm text-slate-300">{competitor.trajectoryReason}</p>
        </div>
      )}

      {/* Threat Drivers */}
      {competitor.threatDrivers && competitor.threatDrivers.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Threat Drivers</h3>
          <div className="flex flex-wrap gap-2">
            {competitor.threatDrivers.map((driver, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400">
                {driver}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Strengths</h3>
          {competitor.strengths.length > 0 ? (
            <ul className="text-sm text-slate-300 space-y-1">
              {competitor.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">+</span>
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No strengths identified</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Weaknesses</h3>
          {competitor.weaknesses.length > 0 ? (
            <ul className="text-sm text-slate-300 space-y-1">
              {competitor.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-400 mt-1">-</span>
                  {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No weaknesses identified</p>
          )}
        </div>
      </div>

      {/* Unique Claims */}
      {competitor.uniqueClaims.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Unique Claims</h3>
          <div className="flex flex-wrap gap-2">
            {competitor.uniqueClaims.map((claim, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
                {claim}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Channels */}
      {competitor.primaryChannels.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Primary Channels</h3>
          <div className="flex flex-wrap gap-2">
            {competitor.primaryChannels.map((channel, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
                {channel}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pricing */}
      {(competitor.pricingSummary || competitor.pricingNotes) && (
        <div>
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Pricing</h3>
          <p className="text-sm text-slate-300">{competitor.pricingSummary || competitor.pricingNotes}</p>
        </div>
      )}

      {/* Position Coordinates */}
      {(competitor.xPosition !== null || competitor.yPosition !== null) && (
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Map Position</h3>
          <div className="flex gap-6">
            <div>
              <span className="text-xs text-slate-500">X Position</span>
              <p className="text-lg font-semibold text-slate-200">{competitor.xPosition ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500">Y Position</span>
              <p className="text-lg font-semibold text-slate-200">{competitor.yPosition ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Provenance */}
      {competitor.provenance && competitor.provenance.length > 0 && (
        <div className="pt-4 border-t border-slate-800">
          <h3 className="text-xs font-medium text-slate-400 uppercase mb-2">Data Sources</h3>
          <div className="flex flex-wrap gap-2">
            {competitor.provenance.slice(0, 3).map((p, i) => (
              <span key={i} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400">
                {p.source} ({Math.round((p.confidence || 0.5) * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab: Features Matrix
// ============================================================================

function FeaturesMatrixTab({
  featuresMatrix,
  competitors,
  companyName,
}: {
  featuresMatrix: FeatureMatrixEntry[];
  competitors: CompetitorProfile[];
  companyName: string;
}) {
  if (featuresMatrix.length === 0) {
    return (
      <EmptyState
        icon="grid"
        title="No Feature Matrix Data"
        description="Run Competitor Lab to analyze and compare features across competitors."
      />
    );
  }

  // Get unique competitor names from feature matrix
  const competitorNames = Array.from(
    new Set(featuresMatrix.flatMap((f) => f.competitors.map((c) => c.name)))
  ).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Features Tracked"
          value={featuresMatrix.length}
          color="blue"
        />
        <StatCard
          label="You Have"
          value={featuresMatrix.filter((f) => f.companySupport).length}
          color="emerald"
        />
        <StatCard
          label="Feature Gaps"
          value={featuresMatrix.filter((f) => !f.companySupport && f.competitors.some((c) => c.hasFeature)).length}
          color="red"
        />
        <StatCard
          label="Unique Advantages"
          value={featuresMatrix.filter((f) => f.companySupport && f.competitors.every((c) => !c.hasFeature)).length}
          color="purple"
        />
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="text-left p-3 font-medium text-slate-400 sticky left-0 bg-slate-900 z-10 min-w-[200px]">
                Feature
              </th>
              <th className="text-center p-3 font-medium text-emerald-400 min-w-[100px]">
                {companyName}
              </th>
              {competitorNames.map((name) => (
                <th key={name} className="text-center p-3 font-medium text-slate-400 min-w-[100px]">
                  {name.length > 12 ? name.slice(0, 10) + '...' : name}
                </th>
              ))}
              <th className="text-center p-3 font-medium text-slate-500 min-w-[80px]">
                Importance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {featuresMatrix.map((feature) => (
              <tr key={feature.featureName} className="hover:bg-slate-800/50">
                <td className="p-3 text-slate-200 sticky left-0 bg-slate-900/90 z-10">
                  <div>
                    <span className="font-medium">{feature.featureName}</span>
                    {feature.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{feature.description}</p>
                    )}
                  </div>
                </td>
                <td className="text-center p-3">
                  <FeatureCheck hasFeature={feature.companySupport} isOwn />
                </td>
                {competitorNames.map((name) => {
                  const comp = feature.competitors.find((c) => c.name === name);
                  return (
                    <td key={name} className="text-center p-3">
                      <FeatureCheck hasFeature={comp?.hasFeature ?? false} />
                    </td>
                  );
                })}
                <td className="text-center p-3">
                  <ImportanceBar value={feature.importance ?? 50} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureCheck({ hasFeature, isOwn }: { hasFeature: boolean; isOwn?: boolean }) {
  return hasFeature ? (
    <span className={`inline-block w-5 h-5 rounded-full ${isOwn ? 'bg-emerald-500' : 'bg-blue-500'} flex items-center justify-center`}>
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="inline-block w-5 h-5 rounded-full bg-slate-700" />
  );
}

function ImportanceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-red-500' : value >= 60 ? 'bg-amber-500' : value >= 40 ? 'bg-blue-500' : 'bg-slate-600';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-500">{value}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'red' | 'purple' | 'amber';
}) {
  const colors = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
    </div>
  );
}

// ============================================================================
// Tab: Pricing Landscape
// ============================================================================

function PricingLandscapeTab({
  pricingModels,
  ownPriceTier,
  companyName,
}: {
  pricingModels: PricingModel[];
  ownPriceTier: string | null;
  companyName: string;
}) {
  if (pricingModels.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="No Pricing Data"
        description="Run Competitor Lab to analyze competitor pricing strategies."
      />
    );
  }

  const tierOrder = ['low', 'medium', 'high'] as const;
  const sortedModels = [...pricingModels].sort((a, b) => {
    const aIdx = tierOrder.indexOf(a.priceTier as typeof tierOrder[number]);
    const bIdx = tierOrder.indexOf(b.priceTier as typeof tierOrder[number]);
    return bIdx - aIdx;
  });

  return (
    <div className="space-y-6">
      {/* Own Position */}
      {ownPriceTier && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-medium">{companyName}</span>
            <PriceTierBadge tier={ownPriceTier} />
          </div>
        </div>
      )}

      {/* Pricing Scatterplot (simplified as a list with bars) */}
      <div className="grid grid-cols-1 gap-4">
        {sortedModels.map((model) => (
          <div
            key={model.competitorName}
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-200">{model.competitorName}</span>
                <PriceTierBadge tier={model.priceTier} />
                {model.modelType && (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {model.modelType}
                  </span>
                )}
              </div>
              {model.inferredPricePoint !== null && (
                <span className="text-slate-400 font-mono">
                  {model.currency || '$'}{model.inferredPricePoint}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Value for Money</span>
                  <span>{model.valueForMoneyScore}/100</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      model.valueForMoneyScore >= 70
                        ? 'bg-emerald-500'
                        : model.valueForMoneyScore >= 40
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${model.valueForMoneyScore}%` }}
                  />
                </div>
              </div>
            </div>

            {model.pricingNotes && (
              <p className="mt-2 text-xs text-slate-500">{model.pricingNotes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceTierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    low: 'bg-emerald-500/20 text-emerald-400',
    medium: 'bg-amber-500/20 text-amber-400',
    high: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[tier] || 'bg-slate-700 text-slate-400'}`}>
      {tier} tier
    </span>
  );
}

// ============================================================================
// Tab: Messaging Overlap
// ============================================================================

function MessagingOverlapTab({
  messageOverlap,
  differentiationScore,
}: {
  messageOverlap: MessageOverlap[];
  differentiationScore: number | null;
}) {
  if (messageOverlap.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="No Messaging Data"
        description="Run Competitor Lab to analyze messaging theme overlap with competitors."
      />
    );
  }

  const saturatedThemes = messageOverlap.filter((m) => m.overlapScore >= 60);
  const uniqueThemes = messageOverlap.filter((m) => m.overlapScore < 30 && m.companyUsing);

  return (
    <div className="space-y-6">
      {/* Differentiation Score */}
      {differentiationScore !== null && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-400">Messaging Differentiation Score</h3>
              <p className="text-xs text-slate-500 mt-1">
                Higher is better - indicates unique messaging vs competitors
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-3xl font-bold ${
                  differentiationScore >= 70
                    ? 'text-emerald-400'
                    : differentiationScore >= 40
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {differentiationScore}
              </p>
              <p className="text-xs text-slate-500">out of 100</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Saturated Themes */}
        <div className="rounded-lg border border-red-500/30 bg-slate-900/50 p-4">
          <h3 className="text-sm font-medium text-red-400 mb-3">
            Saturated Themes ({saturatedThemes.length})
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            High overlap with competitors - consider differentiating
          </p>
          {saturatedThemes.length > 0 ? (
            <div className="space-y-3">
              {saturatedThemes.map((theme) => (
                <div key={theme.theme} className="rounded bg-slate-800/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-200">{theme.theme}</span>
                    <span className="text-xs text-red-400">{theme.overlapScore}% overlap</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${theme.overlapScore}%` }}
                    />
                  </div>
                  {theme.competitorsUsingIt.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Also used by: {theme.competitorsUsingIt.slice(0, 3).join(', ')}
                    </p>
                  )}
                  {theme.suggestion && (
                    <p className="text-xs text-amber-400 mt-2">
                      Suggestion: {theme.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No saturated themes detected</p>
          )}
        </div>

        {/* Unique Themes */}
        <div className="rounded-lg border border-emerald-500/30 bg-slate-900/50 p-4">
          <h3 className="text-sm font-medium text-emerald-400 mb-3">
            Unique Themes ({uniqueThemes.length})
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Low overlap - your differentiators to amplify
          </p>
          {uniqueThemes.length > 0 ? (
            <div className="space-y-3">
              {uniqueThemes.map((theme) => (
                <div key={theme.theme} className="rounded bg-slate-800/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-200">{theme.theme}</span>
                    <span className="text-xs text-emerald-400">{theme.overlapScore}% overlap</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${Math.max(5, theme.overlapScore)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No unique themes identified yet</p>
          )}
        </div>
      </div>

      {/* All Themes */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-sm font-medium text-slate-400 mb-4">All Messaging Themes</h3>
        <div className="space-y-2">
          {messageOverlap.map((theme) => (
            <div key={theme.theme} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-300">{theme.theme}</span>
                  {theme.companyUsing && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      You use
                    </span>
                  )}
                </div>
              </div>
              <div className="w-32">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      theme.overlapScore >= 60
                        ? 'bg-red-500'
                        : theme.overlapScore >= 30
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${theme.overlapScore}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-slate-500 w-12 text-right">{theme.overlapScore}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Market Clusters
// ============================================================================

function MarketClustersTab({
  clusters,
  competitors,
  whitespaceMap,
  primaryAxis,
  secondaryAxis,
  ownXPosition,
  ownYPosition,
  companyName,
}: {
  clusters: MarketCluster[];
  competitors: CompetitorProfile[];
  whitespaceMap: WhitespaceOpportunity[];
  primaryAxis: string | null;
  secondaryAxis: string | null;
  ownXPosition: number | null;
  ownYPosition: number | null;
  companyName: string;
}) {
  if (clusters.length === 0 && !primaryAxis) {
    return (
      <EmptyState
        icon="target"
        title="No Cluster Data"
        description="Run Competitor Lab to identify market clusters and whitespace opportunities."
      />
    );
  }

  // Convert -100...+100 to 0...100%
  const toPercent = (val: number) => ((val + 100) / 200) * 100;

  const clusterColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  return (
    <div className="space-y-6">
      {/* Positioning Map with Clusters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-4">
              Positioning Map with Clusters
            </h3>

            <div className="relative aspect-square max-w-lg mx-auto rounded-lg border border-slate-700 bg-slate-900/80">
              {/* Axis lines */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-px h-full bg-slate-700" />
                <div className="absolute h-px w-full bg-slate-700" />
              </div>

              {/* Cluster regions */}
              {clusters.map((cluster, idx) => {
                const x = toPercent(cluster.clusterPosition?.x || 0);
                const y = 100 - toPercent(cluster.clusterPosition?.y || 0);
                const color = cluster.color || clusterColors[idx % clusterColors.length];

                return (
                  <div
                    key={cluster.clusterName}
                    className="absolute w-24 h-24 rounded-full opacity-20"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: color,
                    }}
                  />
                );
              })}

              {/* Whitespace markers */}
              {whitespaceMap.map((ws) => {
                const x = toPercent(ws.position?.x || 0);
                const y = 100 - toPercent(ws.position?.y || 0);

                return (
                  <div
                    key={ws.name}
                    className="absolute w-8 h-8 border-2 border-dashed border-emerald-400 rounded-full opacity-50"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    title={ws.name}
                  />
                );
              })}

              {/* Competitor points */}
              {competitors
                .filter((c) => c.category !== 'own' && (c.xPosition !== null || c.yPosition !== null))
                .map((c) => {
                  const x = toPercent(c.xPosition ?? 0);
                  const y = 100 - toPercent(c.yPosition ?? 0);

                  return (
                    <div
                      key={c.name}
                      className="absolute group"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div
                        className="w-3 h-3 rounded-full bg-slate-400"
                        style={{ opacity: c.confidence ?? 0.7 }}
                      />
                      <div className="absolute left-1/2 -translate-x-1/2 -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded text-xs text-slate-200 whitespace-nowrap z-10">
                        {c.name}
                      </div>
                    </div>
                  );
                })}

              {/* Own position */}
              {ownXPosition !== null && ownYPosition !== null && (
                <div
                  className="absolute group"
                  style={{
                    left: `${toPercent(ownXPosition)}%`,
                    top: `${100 - toPercent(ownYPosition)}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
                  <div className="absolute left-1/2 -translate-x-1/2 -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded text-xs text-slate-200 whitespace-nowrap z-10">
                    {companyName}
                  </div>
                </div>
              )}

              {/* Axis labels */}
              {primaryAxis && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 text-xs text-slate-500">
                  {primaryAxis}
                </div>
              )}
              {secondaryAxis && (
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-slate-500 whitespace-nowrap">
                  {secondaryAxis}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-400">You</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-slate-400" />
                <span className="text-slate-400">Competitor</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-emerald-400" />
                <span className="text-slate-400">Whitespace</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cluster List */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-400">Market Clusters</h3>
          {clusters.map((cluster, idx) => {
            const color = cluster.color || clusterColors[idx % clusterColors.length];

            return (
              <div
                key={cluster.clusterName}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-slate-200">{cluster.clusterName}</span>
                </div>
                {cluster.description && (
                  <p className="text-xs text-slate-500 mb-2">{cluster.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400">
                    {cluster.competitors.length} competitor{cluster.competitors.length !== 1 ? 's' : ''}
                  </span>
                  <span className={cluster.threatLevel >= 60 ? 'text-red-400' : 'text-slate-400'}>
                    Threat: {cluster.threatLevel}/100
                  </span>
                </div>
                {cluster.whitespaceOpportunity && (
                  <p className="text-xs text-emerald-400 mt-2">
                    Opportunity: {cluster.whitespaceOpportunity}
                  </p>
                )}
              </div>
            );
          })}

          {/* Whitespace Opportunities */}
          {whitespaceMap.length > 0 && (
            <>
              <h3 className="text-sm font-medium text-slate-400 mt-6">Whitespace Opportunities</h3>
              {whitespaceMap.map((ws) => (
                <div
                  key={ws.name}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-emerald-400">{ws.name}</span>
                    <span className="text-xs text-slate-400">
                      Fit: {ws.strategicFit}/100
                    </span>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-slate-400 mb-2">{ws.description}</p>
                  )}
                  {ws.captureActions && ws.captureActions.length > 0 && (
                    <div className="text-xs text-slate-500">
                      <span className="text-slate-400">Actions: </span>
                      {ws.captureActions.slice(0, 2).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Threats & Trajectory
// ============================================================================

function ThreatsTrajectoryTab({
  threatScores,
  competitors,
  overallThreatLevel,
}: {
  threatScores: ThreatScore[];
  competitors: CompetitorProfile[];
  overallThreatLevel: number | null;
}) {
  const hasData = threatScores.length > 0 || competitors.some((c) => c.threatLevel !== null);

  if (!hasData) {
    return (
      <EmptyState
        icon="alert"
        title="No Threat Data"
        description="Run Competitor Lab to analyze competitor threats and trajectory modeling."
      />
    );
  }

  // Combine threat scores with competitor data
  const threatData = threatScores.length > 0
    ? threatScores
    : competitors
        .filter((c) => c.threatLevel !== null)
        .map((c) => ({
          competitorName: c.name,
          threatLevel: c.threatLevel!,
          threatDrivers: c.threatDrivers || [],
          timeHorizon: null,
          defensiveActions: [],
        }));

  const criticalThreats = threatData.filter((t) => t.threatLevel >= 70);
  const risingCompetitors = competitors.filter((c) => c.trajectory === 'rising');

  return (
    <div className="space-y-6">
      {/* Overall Threat Level */}
      {overallThreatLevel !== null && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-400">Overall Competitive Threat Level</h3>
              <p className="text-xs text-slate-500 mt-1">
                Aggregate threat across all tracked competitors
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-4xl font-bold ${
                  overallThreatLevel >= 70
                    ? 'text-red-400'
                    : overallThreatLevel >= 50
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {overallThreatLevel}
              </p>
              <p className="text-xs text-slate-500">out of 100</p>
            </div>
          </div>
          <div className="mt-4 h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                overallThreatLevel >= 70
                  ? 'bg-red-500'
                  : overallThreatLevel >= 50
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${overallThreatLevel}%` }}
            />
          </div>
        </div>
      )}

      {/* Critical Threats Alert */}
      {criticalThreats.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-medium text-red-400">
                {criticalThreats.length} Critical Threat{criticalThreats.length !== 1 ? 's' : ''} Detected
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {criticalThreats.map((t) => t.competitorName).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Threat Rankings */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Threat Rankings</h3>
          <div className="space-y-3">
            {threatData
              .sort((a, b) => b.threatLevel - a.threatLevel)
              .map((threat) => (
                <div key={threat.competitorName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-200">{threat.competitorName}</span>
                    <span
                      className={`text-sm font-medium ${
                        threat.threatLevel >= 70
                          ? 'text-red-400'
                          : threat.threatLevel >= 50
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {threat.threatLevel}/100
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        threat.threatLevel >= 70
                          ? 'bg-red-500'
                          : threat.threatLevel >= 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${threat.threatLevel}%` }}
                    />
                  </div>
                  {threat.threatDrivers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {threat.threatDrivers.slice(0, 3).map((driver, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                          {driver}
                        </span>
                      ))}
                    </div>
                  )}
                  {threat.defensiveActions && threat.defensiveActions.length > 0 && (
                    <p className="text-xs text-amber-400">
                      Defensive: {threat.defensiveActions[0]}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Trajectory Analysis */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Competitor Trajectories</h3>

          {/* Rising Competitors */}
          {risingCompetitors.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-red-400 uppercase mb-3">
                Rising ({risingCompetitors.length})
              </h4>
              <div className="space-y-3">
                {risingCompetitors.map((c) => (
                  <div key={c.name} className="rounded bg-red-500/10 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-red-400">↗</span>
                      <span className="text-sm text-slate-200">{c.name}</span>
                    </div>
                    {c.trajectoryReason && (
                      <p className="text-xs text-slate-400">{c.trajectoryReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Falling Competitors */}
          {competitors.filter((c) => c.trajectory === 'falling').length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-medium text-emerald-400 uppercase mb-3">
                Falling ({competitors.filter((c) => c.trajectory === 'falling').length})
              </h4>
              <div className="space-y-3">
                {competitors
                  .filter((c) => c.trajectory === 'falling')
                  .map((c) => (
                    <div key={c.name} className="rounded bg-emerald-500/10 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-emerald-400">↘</span>
                        <span className="text-sm text-slate-200">{c.name}</span>
                      </div>
                      {c.trajectoryReason && (
                        <p className="text-xs text-slate-400">{c.trajectoryReason}</p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Stagnant Competitors */}
          {competitors.filter((c) => c.trajectory === 'stagnant').length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-400 uppercase mb-3">
                Stagnant ({competitors.filter((c) => c.trajectory === 'stagnant').length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {competitors
                  .filter((c) => c.trajectory === 'stagnant')
                  .map((c) => (
                    <span key={c.name} className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400">
                      {c.name}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Substitutes
// ============================================================================

function SubstitutesTab({ substitutes }: { substitutes: Substitute[] }) {
  if (substitutes.length === 0) {
    return (
      <EmptyState
        icon="list"
        title="No Substitutes Identified"
        description="Run Competitor Lab to identify substitute products and category-creep threats."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-sm font-medium text-slate-400 mb-2">About Substitutes</h3>
        <p className="text-xs text-slate-500">
          Substitutes are alternative solutions customers might choose instead of your product category.
          They compete indirectly by solving similar problems in different ways.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {substitutes.map((sub) => (
          <div
            key={sub.name}
            className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-medium text-slate-200">{sub.name}</h4>
                {sub.category && (
                  <span className="text-xs text-slate-500">{sub.category}</span>
                )}
              </div>
              <ThreatBadge level={sub.threatLevel} />
            </div>

            {sub.reasonCustomersChooseThem && (
              <div className="mb-3">
                <p className="text-xs text-slate-400 mb-1">Why customers choose this:</p>
                <p className="text-sm text-slate-300">{sub.reasonCustomersChooseThem}</p>
              </div>
            )}

            {sub.counterStrategy && (
              <div className="rounded bg-amber-500/10 p-2">
                <p className="text-xs text-amber-400">
                  Counter-strategy: {sub.counterStrategy}
                </p>
              </div>
            )}

            {sub.domain && (
              <a
                href={`https://${sub.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-rose-400 hover:text-rose-300 mt-2 inline-block"
              >
                {sub.domain}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Refinement
// ============================================================================

function RefinementTab({
  isRunning,
  refinementResult,
  onRun,
}: {
  isRunning: boolean;
  refinementResult: LabRefinementRunResult | null;
  onRun: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Competitor Lab Refinement</h2>
          <p className="text-sm text-slate-400 mt-1">
            Comprehensive competitive analysis with AI-powered insights
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Spinner />
              Analyzing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                />
              </svg>
              Run Full Analysis
            </>
          )}
        </button>
      </div>

      {/* Refinement Result */}
      {refinementResult ? (
        <RefinementSummary result={refinementResult} showDetails />
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-200 mb-2">Run Full Competitive Analysis</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            The expanded Competitor Lab will analyze your competitive landscape and generate:
          </p>
          <ul className="text-sm text-slate-500 mt-4 space-y-1">
            <li>• Competitor profiles with confidence scores</li>
            <li>• Feature matrix comparison</li>
            <li>• Pricing landscape analysis</li>
            <li>• Messaging overlap detection</li>
            <li>• Market cluster identification</li>
            <li>• Threat & trajectory modeling</li>
            <li>• Whitespace opportunities</li>
            <li>• Substitute detection</li>
          </ul>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
        <h4 className="text-sm font-medium text-slate-200 mb-2">How It Works</h4>
        <ul className="text-xs text-slate-400 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-rose-400">1.</span>
            Loads current competitive context from Brain
          </li>
          <li className="flex items-start gap-2">
            <span className="text-rose-400">2.</span>
            AI analyzes website, industry signals, and market data
          </li>
          <li className="flex items-start gap-2">
            <span className="text-rose-400">3.</span>
            Identifies competitors, deduplicates, and merges records
          </li>
          <li className="flex items-start gap-2">
            <span className="text-rose-400">4.</span>
            Extracts features, pricing, messaging themes, and threats
          </li>
          <li className="flex items-start gap-2">
            <span className="text-rose-400">5.</span>
            Maps market clusters and whitespace opportunities
          </li>
          <li className="flex items-start gap-2">
            <span className="text-rose-400">6.</span>
            Records provenance with confidence scores for traceability
          </li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// Tab: Discovery (Competition Lab v2)
// ============================================================================

function DiscoveryTab({
  isDiscovering,
  discoveryResult,
  existingCount,
  onRunDiscovery,
  companyName,
}: {
  isDiscovering: boolean;
  discoveryResult: DiscoveryResult | null;
  existingCount: number;
  onRunDiscovery: () => void;
  companyName: string;
}) {
  return (
    <div className="space-y-6">
      {/* Discovery Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Competitor Discovery</h2>
          <p className="text-sm text-slate-400 mt-1">
            AI-powered multi-source competitor discovery for {companyName}
          </p>
        </div>
        <button
          onClick={onRunDiscovery}
          disabled={isDiscovering}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDiscovering ? (
            <>
              <Spinner />
              Discovering...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Run Discovery
            </>
          )}
        </button>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500">Competitors Tracked</p>
          <p className="text-2xl font-bold text-slate-200">{existingCount}</p>
        </div>
        {discoveryResult && (
          <>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs text-slate-500">Newly Discovered</p>
              <p className="text-2xl font-bold text-emerald-400">{discoveryResult.summary.totalDiscovered}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-500">Run Status</p>
              <p className="text-lg font-medium text-slate-200 capitalize">{discoveryResult.status}</p>
            </div>
          </>
        )}
      </div>

      {/* Discovery Result */}
      {discoveryResult ? (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{discoveryResult.summary.coreCount}</p>
              <p className="text-xs text-slate-400 mt-1">Core Competitors</p>
              <p className="text-xs text-slate-500">Direct competition</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center">
              <p className="text-3xl font-bold text-amber-400">{discoveryResult.summary.secondaryCount}</p>
              <p className="text-xs text-slate-400 mt-1">Secondary</p>
              <p className="text-xs text-slate-500">Partial overlap</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-center">
              <p className="text-3xl font-bold text-slate-300">{discoveryResult.summary.alternativeCount}</p>
              <p className="text-xs text-slate-400 mt-1">Alternatives</p>
              <p className="text-xs text-slate-500">Adjacent solutions</p>
            </div>
          </div>

          {/* Discovered Competitors Bubble Map */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Discovery Results - Positioning Map</h3>
            <div className="relative aspect-square max-w-2xl mx-auto rounded-lg border border-slate-700 bg-slate-900/80">
              {/* Axis lines */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-px h-full bg-slate-700" />
                <div className="absolute h-px w-full bg-slate-700" />
              </div>

              {/* Grid lines */}
              <div className="absolute inset-0">
                <div className="absolute w-px h-full left-1/4 bg-slate-800" />
                <div className="absolute w-px h-full left-3/4 bg-slate-800" />
                <div className="absolute h-px w-full top-1/4 bg-slate-800" />
                <div className="absolute h-px w-full top-3/4 bg-slate-800" />
              </div>

              {/* Competitor bubbles */}
              {discoveryResult.competitors.map((comp, idx) => {
                const x = comp.offerSimilarity; // 0-100
                const y = 100 - comp.audienceSimilarity; // 0-100, inverted for display
                const size = Math.max(24, Math.min(56, comp.overallScore / 2 + 12));

                const roleColors: Record<string, string> = {
                  core: 'bg-red-500 border-red-400',
                  secondary: 'bg-amber-500 border-amber-400',
                  alternative: 'bg-slate-500 border-slate-400',
                };

                return (
                  <div
                    key={comp.competitorDomain || idx}
                    className="absolute group"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div
                      className={`rounded-full ${roleColors[comp.role] || 'bg-slate-500 border-slate-400'} border-2 flex items-center justify-center text-white text-xs font-bold shadow-lg cursor-pointer transition-transform hover:scale-110`}
                      style={{ width: size, height: size }}
                      title={`${comp.competitorName}: ${comp.overallScore}% match`}
                    >
                      {comp.competitorName.slice(0, 2).toUpperCase()}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute left-1/2 -translate-x-1/2 -top-20 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 p-3 rounded-lg text-xs text-slate-200 whitespace-nowrap z-20 shadow-xl border border-slate-700 pointer-events-none">
                      <p className="font-semibold text-white">{comp.competitorName}</p>
                      <p className="text-slate-400">{comp.competitorDomain}</p>
                      <div className="mt-2 space-y-1">
                        <p>Overall: <span className="text-amber-400">{comp.overallScore}%</span></p>
                        <p>Offer: <span className="text-blue-400">{comp.offerSimilarity}%</span></p>
                        <p>Audience: <span className="text-emerald-400">{comp.audienceSimilarity}%</span></p>
                        {comp.threatLevel !== null && (
                          <p>Threat: <span className={comp.threatLevel >= 60 ? 'text-red-400' : 'text-slate-400'}>{comp.threatLevel}</span></p>
                        )}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          comp.role === 'core' ? 'bg-red-500/20 text-red-400' :
                          comp.role === 'secondary' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-700 text-slate-400'
                        }`}>
                          {comp.role}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Own position (center) */}
              <div
                className="absolute group"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500 border-3 border-white flex items-center justify-center text-white text-sm font-bold shadow-lg">
                  YOU
                </div>
              </div>

              {/* Axis labels */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8 text-xs text-slate-500">
                Offer Similarity (0-100%)
              </div>
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-slate-500 whitespace-nowrap">
                Audience Similarity (0-100%)
              </div>

              {/* Quadrant labels */}
              <div className="absolute top-2 left-2 text-xs text-slate-600">Low Offer / High Audience</div>
              <div className="absolute top-2 right-2 text-xs text-slate-600">High Offer / High Audience</div>
              <div className="absolute bottom-2 left-2 text-xs text-slate-600">Low Offer / Low Audience</div>
              <div className="absolute bottom-2 right-2 text-xs text-slate-600">High Offer / Low Audience</div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
                <span className="text-slate-400">You ({companyName})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500" />
                <span className="text-slate-400">Core</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500" />
                <span className="text-slate-400">Secondary</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-500" />
                <span className="text-slate-400">Alternative</span>
              </div>
            </div>
          </div>

          {/* Competitor List */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Discovered Competitors</h3>
            <div className="space-y-2">
              {discoveryResult.competitors.map((comp, idx) => (
                <div
                  key={comp.competitorDomain || idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      comp.role === 'core' ? 'bg-red-500' :
                      comp.role === 'secondary' ? 'bg-amber-500' :
                      'bg-slate-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-200">{comp.competitorName}</p>
                      <p className="text-xs text-slate-500">{comp.competitorDomain}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <p className="text-slate-500">Score</p>
                      <p className="text-amber-400 font-medium">{comp.overallScore}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500">Offer</p>
                      <p className="text-blue-400 font-medium">{comp.offerSimilarity}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500">Audience</p>
                      <p className="text-emerald-400 font-medium">{comp.audienceSimilarity}%</p>
                    </div>
                    {comp.threatLevel !== null && (
                      <div className="text-right">
                        <p className="text-slate-500">Threat</p>
                        <p className={`font-medium ${comp.threatLevel >= 60 ? 'text-red-400' : 'text-slate-400'}`}>
                          {comp.threatLevel}
                        </p>
                      </div>
                    )}
                    <span className={`px-2 py-1 rounded text-xs ${
                      comp.role === 'core' ? 'bg-red-500/20 text-red-400' :
                      comp.role === 'secondary' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {comp.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-200 mb-2">Discover Your Competition</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Our AI pipeline uses multiple discovery sources to find and score competitors based on offer similarity, audience overlap, geographic presence, and pricing.
          </p>

          <div className="max-w-xl mx-auto text-left mb-8">
            <h4 className="text-xs font-medium text-slate-400 uppercase mb-3">Discovery Sources</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                <span className="text-rose-400">1.</span>
                <span className="text-slate-300">Brand queries (direct competitors)</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                <span className="text-rose-400">2.</span>
                <span className="text-slate-300">Category searches</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                <span className="text-rose-400">3.</span>
                <span className="text-slate-300">Geographic footprint</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                <span className="text-rose-400">4.</span>
                <span className="text-slate-300">Marketplace listings</span>
              </div>
            </div>
          </div>

          <div className="max-w-xl mx-auto text-left mb-8">
            <h4 className="text-xs font-medium text-slate-400 uppercase mb-3">Scoring Formula</h4>
            <div className="p-4 rounded bg-slate-800/50 font-mono text-xs text-slate-300">
              <p>overall_score = 0.35 × offer_similarity</p>
              <p className="ml-16">+ 0.35 × audience_similarity</p>
              <p className="ml-16">+ 0.20 × geo_overlap</p>
              <p className="ml-16">+ 0.10 × price_tier_match</p>
            </div>
          </div>

          <button
            onClick={onRunDiscovery}
            disabled={isDiscovering}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-medium transition-all"
          >
            Start Discovery
          </button>
        </div>
      )}

      {/* How It Works */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4">
        <h4 className="text-sm font-medium text-slate-200 mb-3">How Discovery Works</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400">
          <div>
            <p className="font-medium text-slate-300 mb-1">1. Query Generation</p>
            <p>AI generates search queries based on your brand, category, and market context</p>
          </div>
          <div>
            <p className="font-medium text-slate-300 mb-1">2. Enrichment</p>
            <p>Each candidate is enriched with website data, positioning, pricing signals</p>
          </div>
          <div>
            <p className="font-medium text-slate-300 mb-1">3. Scoring & Classification</p>
            <p>Multi-dimensional scoring determines core, secondary, or alternative status</p>
          </div>
        </div>
      </div>
    </div>
  );
}
