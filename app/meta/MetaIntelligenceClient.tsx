'use client';

// app/meta/MetaIntelligenceClient.tsx
// Client component for Meta Intelligence Dashboard
// Styled to match Hive OS design system

import { useState, useEffect } from 'react';

// Types for API responses
interface DiscoveredPattern {
  id: string;
  type: string;
  name: string;
  description: string;
  confidence: number;
  affectedCompanyCount: number;
  verticals?: string[];
  insight: string;
  recommendation: string;
  discoveredAt: string;
}

interface GlobalAnomaly {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedVerticals: string[];
  affectedCompanyIds: string[];
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviationPercent: number;
  possibleCauses: string[];
  recommendedActions: string[];
  detectedAt: string;
  status: string;
}

interface BenchmarkComparison {
  metric: string;
  companyValue: number;
  benchmarkValue: number;
  percentile: number;
  direction: 'higher is better' | 'lower is better';
  verdict: 'above_benchmark' | 'at_benchmark' | 'below_benchmark';
}

interface VerticalIntelligence {
  vertical: string;
  companyCount: number;
  audienceExpectations: {
    commonSegments: string[];
    commonChannels: string[];
    avgPersonaCount: number;
  };
  creativeNorms: {
    topFormats: string[];
    avgToneWords: string[];
    commonThemes: string[];
  };
  kpiRanges: {
    roas: { min: number; max: number; avg: number };
    ctr: { min: number; max: number; avg: number };
    conversionRate: { min: number; max: number; avg: number };
    cac: { min: number; max: number; avg: number };
    ltv: { min: number; max: number; avg: number };
  };
  seasonalPatterns: Record<number, number>;
}

interface MetaReport {
  generatedAt: string;
  summary: {
    totalCompanies: number;
    verticalsAnalyzed: number;
    patternsDiscovered: number;
    activeAnomalies: number;
    memorizedInsights: number;
    schemaProposals: number;
  };
  topPatterns: DiscoveredPattern[];
  activeAnomalies: GlobalAnomaly[];
  verticalHighlights: Array<{
    vertical: string;
    companyCount: number;
    topPattern: string;
  }>;
  systemHealth: {
    lastPatternScan: string;
    lastAnomalyCheck: string;
    memoryUtilization: number;
  };
}

type TabId = 'patterns' | 'anomalies' | 'verticals' | 'benchmarks';

export function MetaIntelligenceClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<MetaReport | null>(null);
  const [patterns, setPatterns] = useState<DiscoveredPattern[]>([]);
  const [anomalies, setAnomalies] = useState<GlobalAnomaly[]>([]);
  const [verticals, setVerticals] = useState<VerticalIntelligence[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('patterns');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [reportRes, patternsRes, anomaliesRes, verticalsRes] = await Promise.all([
        fetch('/api/meta/report'),
        fetch('/api/meta/patterns'),
        fetch('/api/meta/anomalies'),
        fetch('/api/meta/verticals'),
      ]);

      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData);
      }

      if (patternsRes.ok) {
        const patternsData = await patternsRes.json();
        setPatterns(patternsData.patterns || []);
      }

      if (anomaliesRes.ok) {
        const anomaliesData = await anomaliesRes.json();
        setAnomalies(anomaliesData.anomalies || []);
      }

      if (verticalsRes.ok) {
        const verticalsData = await verticalsRes.json();
        setVerticals(verticalsData.verticals || []);
      }
    } catch (err) {
      setError('Failed to load meta intelligence data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPatterns() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/meta/patterns', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPatterns(data.patterns || []);
      }
    } catch (err) {
      console.error('Failed to refresh patterns:', err);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <BrainIcon className="h-7 w-7 text-purple-400" />
            Meta Intelligence
          </h1>
          <p className="text-slate-400 mt-1">
            Cross-company pattern analysis and emergent intelligence
          </p>
        </div>
        <button
          onClick={refreshPatterns}
          disabled={refreshing}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Patterns
        </button>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryCard
            icon={<BuildingIcon className="h-5 w-5" />}
            label="Companies"
            value={report.summary.totalCompanies}
          />
          <SummaryCard
            icon={<LayersIcon className="h-5 w-5" />}
            label="Verticals"
            value={report.summary.verticalsAnalyzed}
          />
          <SummaryCard
            icon={<LightbulbIcon className="h-5 w-5" />}
            label="Patterns"
            value={report.summary.patternsDiscovered}
          />
          <SummaryCard
            icon={<AlertTriangleIcon className="h-5 w-5" />}
            label="Anomalies"
            value={report.summary.activeAnomalies}
            warning={report.summary.activeAnomalies > 0}
          />
          <SummaryCard
            icon={<BrainIcon className="h-5 w-5" />}
            label="Insights"
            value={report.summary.memorizedInsights}
          />
          <SummaryCard
            icon={<ZapIcon className="h-5 w-5" />}
            label="Schema Proposals"
            value={report.summary.schemaProposals}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {[
            { id: 'patterns' as TabId, label: 'Patterns', icon: <LightbulbIcon className="h-4 w-4" /> },
            { id: 'anomalies' as TabId, label: 'Anomalies', icon: <AlertTriangleIcon className="h-4 w-4" /> },
            { id: 'verticals' as TabId, label: 'Verticals', icon: <BarChartIcon className="h-4 w-4" /> },
            { id: 'benchmarks' as TabId, label: 'Benchmarks', icon: <TrendingUpIcon className="h-4 w-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-purple-400 border-purple-400'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'patterns' && <PatternsTab patterns={patterns} />}
        {activeTab === 'anomalies' && <AnomaliesTab anomalies={anomalies} />}
        {activeTab === 'verticals' && <VerticalsTab verticals={verticals} />}
        {activeTab === 'benchmarks' && <BenchmarksTab />}
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({
  icon,
  label,
  value,
  warning = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <div className={`bg-slate-900/50 border rounded-xl p-4 ${warning ? 'border-yellow-500/50' : 'border-slate-800'}`}>
      <div className="flex items-center gap-2 text-slate-400 mb-1">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

// Patterns Tab
function PatternsTab({ patterns }: { patterns: DiscoveredPattern[] }) {
  if (patterns.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
        <LightbulbIcon className="h-12 w-12 mx-auto text-slate-600 mb-4" />
        <p className="text-slate-400">No patterns discovered yet.</p>
        <p className="text-sm text-slate-500 mt-1">
          Patterns are discovered by analyzing data across all companies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {patterns.map((pattern) => (
        <div key={pattern.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <PatternTypeIcon type={pattern.type} />
              <h3 className="text-lg font-medium text-slate-100">{pattern.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {pattern.affectedCompanyCount} companies
              </span>
              <ConfidenceBadge confidence={pattern.confidence} />
            </div>
          </div>
          <p className="text-slate-400 text-sm mb-4">{pattern.description}</p>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-1">Insight</h4>
              <p className="text-sm text-slate-400">{pattern.insight}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-1">Recommendation</h4>
              <p className="text-sm text-slate-400">{pattern.recommendation}</p>
            </div>
          </div>

          {pattern.verticals && pattern.verticals.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {pattern.verticals.map((v) => (
                <span key={v} className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400">
                  {v}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PatternTypeIcon({ type }: { type: string }) {
  const iconClass = 'h-5 w-5';
  switch (type) {
    case 'media_mix':
      return <BarChartIcon className={`${iconClass} text-blue-400`} />;
    case 'creative':
      return <LightbulbIcon className={`${iconClass} text-yellow-400`} />;
    case 'persona_cluster':
      return <BuildingIcon className={`${iconClass} text-green-400`} />;
    case 'seasonal':
      return <ActivityIcon className={`${iconClass} text-purple-400`} />;
    case 'kpi_breakpoint':
      return <TrendingUpIcon className={`${iconClass} text-red-400`} />;
    default:
      return <BrainIcon className={`${iconClass} text-slate-400`} />;
  }
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 0.8
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : confidence >= 0.6
    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-slate-700 text-slate-400 border-slate-600';

  return (
    <span className={`px-2 py-1 text-xs rounded-full border ${color}`}>
      {Math.round(confidence * 100)}% confidence
    </span>
  );
}

// Anomalies Tab
function AnomaliesTab({ anomalies }: { anomalies: GlobalAnomaly[] }) {
  if (anomalies.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
        <CheckCircleIcon className="h-12 w-12 mx-auto text-green-500 mb-4" />
        <p className="text-slate-400">No active anomalies detected.</p>
        <p className="text-sm text-slate-500 mt-1">
          All metrics are within expected ranges.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {anomalies.map((anomaly) => (
        <div
          key={anomaly.id}
          className={`bg-slate-900/50 rounded-xl p-5 border ${
            anomaly.severity === 'critical'
              ? 'border-red-500/50'
              : anomaly.severity === 'warning'
              ? 'border-yellow-500/50'
              : 'border-slate-800'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <SeverityIcon severity={anomaly.severity} />
              <h3 className="text-lg font-medium text-slate-100">{anomaly.title}</h3>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full ${
              anomaly.severity === 'critical'
                ? 'bg-red-500/20 text-red-400'
                : anomaly.severity === 'warning'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {anomaly.severity}
            </span>
          </div>

          <p className="text-slate-400 text-sm mb-4">{anomaly.description}</p>

          <div className="grid grid-cols-3 gap-4 text-sm mb-4 p-3 bg-slate-800/50 rounded-lg">
            <div>
              <span className="text-slate-500">Metric:</span>
              <span className="ml-2 text-slate-200 font-medium">{anomaly.metric}</span>
            </div>
            <div>
              <span className="text-slate-500">Expected:</span>
              <span className="ml-2 text-slate-200 font-medium">{anomaly.expectedValue.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500">Actual:</span>
              <span className="ml-2 text-slate-200 font-medium">{anomaly.actualValue.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Possible Causes</h4>
              <ul className="text-sm text-slate-400 space-y-1">
                {anomaly.possibleCauses.slice(0, 3).map((cause, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-slate-600 mt-1">•</span>
                    {cause}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Recommended Actions</h4>
              <ul className="text-sm text-slate-400 space-y-1">
                {anomaly.recommendedActions.slice(0, 3).map((action, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-slate-600 mt-1">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex gap-2 mt-4 flex-wrap">
            {anomaly.affectedVerticals.map((v) => (
              <span key={v} className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400 border border-slate-700">
                {v}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  const iconClass = 'h-5 w-5';
  switch (severity) {
    case 'critical':
      return <AlertTriangleIcon className={`${iconClass} text-red-500`} />;
    case 'warning':
      return <AlertTriangleIcon className={`${iconClass} text-yellow-500`} />;
    default:
      return <AlertTriangleIcon className={`${iconClass} text-blue-500`} />;
  }
}

// Verticals Tab
function VerticalsTab({ verticals }: { verticals: VerticalIntelligence[] }) {
  if (verticals.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
        <LayersIcon className="h-12 w-12 mx-auto text-slate-600 mb-4" />
        <p className="text-slate-400">No vertical intelligence available.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {verticals.map((vertical) => (
        <div key={vertical.vertical} className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-100">{vertical.vertical}</h3>
            <span className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-300">
              {vertical.companyCount} companies
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">KPI Ranges</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">ROAS:</span>
                  <span className="text-slate-300">
                    {vertical.kpiRanges.roas.min.toFixed(1)} - {vertical.kpiRanges.roas.max.toFixed(1)}x
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CTR:</span>
                  <span className="text-slate-300">
                    {(vertical.kpiRanges.ctr.min * 100).toFixed(1)}% - {(vertical.kpiRanges.ctr.max * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Top Channels</h4>
              <div className="flex gap-2 flex-wrap">
                {vertical.audienceExpectations.commonChannels.slice(0, 4).map((channel) => (
                  <span key={channel} className="px-2 py-0.5 text-xs rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {channel}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">Creative Norms</h4>
              <div className="flex gap-2 flex-wrap">
                {vertical.creativeNorms.topFormats.slice(0, 3).map((format) => (
                  <span key={format} className="px-2 py-0.5 text-xs rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {format}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Benchmarks Tab
function BenchmarksTab() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkComparison[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');

  async function loadBenchmarks(companyId: string) {
    if (!companyId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/meta/benchmarks?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setBenchmarks(data.comparisons || []);
      }
    } catch (err) {
      console.error('Failed to load benchmarks:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <h3 className="text-lg font-medium text-slate-100 mb-2">Company Benchmarks</h3>
      <p className="text-slate-400 text-sm mb-4">
        Compare a company's performance against industry benchmarks
      </p>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Enter Company ID"
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
        />
        <button
          onClick={() => loadBenchmarks(selectedCompany)}
          disabled={loading || !selectedCompany}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm text-white transition-colors"
        >
          {loading ? 'Loading...' : 'Compare'}
        </button>
      </div>

      {benchmarks && benchmarks.length > 0 && (
        <div className="space-y-2">
          {benchmarks.map((benchmark) => (
            <BenchmarkRow key={benchmark.metric} benchmark={benchmark} />
          ))}
        </div>
      )}
    </div>
  );
}

function BenchmarkRow({ benchmark }: { benchmark: BenchmarkComparison }) {
  const verdictColors: Record<string, string> = {
    above_benchmark: 'text-green-400',
    at_benchmark: 'text-yellow-400',
    below_benchmark: 'text-red-400',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
      <div>
        <div className="font-medium text-slate-200">{benchmark.metric}</div>
        <div className="text-sm text-slate-500">
          Company: {benchmark.companyValue.toFixed(2)} | Benchmark: {benchmark.benchmarkValue.toFixed(2)}
        </div>
      </div>
      <div className="text-right">
        <div className={`font-medium ${verdictColors[benchmark.verdict] || 'text-slate-400'}`}>
          {benchmark.percentile.toFixed(0)}th percentile
        </div>
        <div className="text-xs text-slate-500">
          {benchmark.verdict.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-64 bg-slate-800 rounded animate-pulse" />
          <div className="h-4 w-48 bg-slate-800 rounded animate-pulse mt-2" />
        </div>
        <div className="h-10 w-36 bg-slate-800 rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>

      <div className="h-10 w-full max-w-md bg-slate-800 rounded animate-pulse" />

      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-48 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// Icons
function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
