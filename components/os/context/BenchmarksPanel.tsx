'use client';

// components/os/context/BenchmarksPanel.tsx
// Cross-company benchmarking and similarity panel
//
// Phase 4: Multi-company learning UI (Simplified - no shadcn)

import { useState, useEffect, useCallback } from 'react';

interface SimilarCompany {
  companyId: string;
  companyName: string;
  similarity: number;
  matchingAspects: string[];
  differentiatingAspects: string[];
}

interface BenchmarkPosition {
  metric: {
    id: string;
    name: string;
    description: string;
  };
  value: number | null;
  percentile: number;
  rank: number;
  totalInGroup: number;
  vsAverage: number;
  status: 'leading' | 'above_average' | 'average' | 'below_average' | 'lagging';
  insight: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  similarCompaniesUsingThis: number;
  successRate: number;
  impact: 'high' | 'medium' | 'low';
  priority: number;
}

interface BenchmarkStats {
  embeddings: {
    totalCompanies: number;
    averageCompleteness: number;
    byIndustry: Record<string, number>;
  };
  benchmarks: {
    totalMetrics: number;
    totalCompanies: number;
    averageCoverage: number;
  };
}

interface BenchmarksPanelProps {
  companyId: string;
  companyName?: string;
  onSimilarCompanySelect?: (companyId: string) => void;
  onRecommendationSelect?: (recommendation: Recommendation) => void;
}

export function BenchmarksPanel({
  companyId,
  companyName,
  onSimilarCompanySelect,
  onRecommendationSelect,
}: BenchmarksPanelProps) {
  const [similar, setSimilar] = useState<SimilarCompany[]>([]);
  const [positions, setPositions] = useState<BenchmarkPosition[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [stats, setStats] = useState<BenchmarkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [viewMode, setViewMode] = useState<'similar' | 'benchmark' | 'recommendations'>(
    'similar'
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Check if company is registered
      const embeddingRes = await fetch(
        `/api/context/benchmarks?companyId=${companyId}&mode=embedding`
      );
      if (embeddingRes.ok) {
        const data = await embeddingRes.json();
        setIsRegistered(!!data.embedding);
      }

      // Fetch similar companies
      const similarRes = await fetch(
        `/api/context/benchmarks?companyId=${companyId}&mode=similar&limit=5`
      );
      if (similarRes.ok) {
        const data = await similarRes.json();
        setSimilar(data.similar || []);
      }

      // Fetch benchmark report
      const reportRes = await fetch(
        `/api/context/benchmarks?companyId=${companyId}&mode=report`
      );
      if (reportRes.ok) {
        const data = await reportRes.json();
        setPositions(data.report?.positions || []);
      }

      // Fetch recommendations
      const recsRes = await fetch(
        `/api/context/benchmarks?companyId=${companyId}&mode=recommendations&limit=5`
      );
      if (recsRes.ok) {
        const data = await recsRes.json();
        setRecommendations(data.recommendations || []);
      }

      // Fetch stats
      const statsRes = await fetch(`/api/context/benchmarks?mode=stats`);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch benchmark data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const response = await fetch('/api/context/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, action: 'register' }),
      });

      if (response.ok) {
        setIsRegistered(true);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to register company:', err);
    } finally {
      setRegistering(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'leading':
        return 'text-yellow-400';
      case 'above_average':
        return 'text-green-400';
      case 'average':
        return 'text-slate-400';
      case 'below_average':
        return 'text-orange-400';
      case 'lagging':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'bg-green-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-slate-500';
      default:
        return 'bg-slate-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Benchmarks
          {stats && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
              {stats.embeddings.totalCompanies} companies
            </span>
          )}
        </h3>
        <button
          onClick={fetchData}
          className="p-1 hover:bg-slate-700 rounded"
        >
          <svg className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Registration prompt */}
      {!isRegistered && !loading && (
        <div className="p-4 bg-slate-800/50 rounded-lg text-center">
          <svg className="w-8 h-8 mx-auto mb-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-sm text-slate-300 mb-2">Register for benchmarking</p>
          <p className="text-xs text-slate-500 mb-3">
            Compare your company against similar businesses
          </p>
          <button
            onClick={handleRegister}
            disabled={registering}
            className="px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-300 text-sm hover:bg-amber-500/30 disabled:opacity-50"
          >
            {registering ? 'Registering...' : 'Register Company'}
          </button>
        </div>
      )}

      {isRegistered && (
        <>
          {/* View Mode Tabs */}
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg">
            <button
              className={`flex-1 text-xs px-2 py-1.5 rounded ${
                viewMode === 'similar'
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              onClick={() => setViewMode('similar')}
            >
              Similar
            </button>
            <button
              className={`flex-1 text-xs px-2 py-1.5 rounded ${
                viewMode === 'benchmark'
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              onClick={() => setViewMode('benchmark')}
            >
              Position
            </button>
            <button
              className={`flex-1 text-xs px-2 py-1.5 rounded ${
                viewMode === 'recommendations'
                  ? 'bg-slate-700 text-slate-200'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              onClick={() => setViewMode('recommendations')}
            >
              Learn
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          ) : (
            <>
              {/* Similar Companies View */}
              {viewMode === 'similar' && (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {similar.length > 0 ? (
                    similar.map((company) => (
                      <div
                        key={company.companyId}
                        className="p-3 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/50"
                        onClick={() => onSimilarCompanySelect?.(company.companyId)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                            {company.companyName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm text-slate-200">{company.companyName}</p>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-500"
                                  style={{ width: `${company.similarity * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-500">
                                {Math.round(company.similarity * 100)}% match
                              </span>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        {company.matchingAspects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {company.matchingAspects.slice(0, 3).map((aspect, idx) => (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                                {aspect}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-sm text-slate-500">
                      <p>No similar companies found</p>
                      <p className="text-xs mt-1">More companies need to be registered</p>
                    </div>
                  )}
                </div>
              )}

              {/* Benchmark Position View */}
              {viewMode === 'benchmark' && (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {positions.length > 0 ? (
                    positions.map((position) => (
                      <div
                        key={position.metric.id}
                        className="p-3 border border-slate-700 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${getStatusColor(position.status)}`}>●</span>
                            <span className="font-medium text-sm text-slate-200">
                              {position.metric.name}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            position.status === 'leading' || position.status === 'above_average'
                              ? 'bg-green-500/20 text-green-400'
                              : position.status === 'average'
                              ? 'bg-slate-700 text-slate-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {position.percentile}th percentile
                          </span>
                        </div>

                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              position.percentile >= 75 ? 'bg-green-500' :
                              position.percentile >= 50 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${position.percentile}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            Rank: {position.rank} / {position.totalInGroup}
                          </span>
                          <span className={position.vsAverage > 0 ? 'text-green-400' : position.vsAverage < 0 ? 'text-red-400' : ''}>
                            {position.vsAverage > 0 ? '+' : ''}
                            {position.vsAverage}% vs avg
                          </span>
                        </div>

                        <p className="text-xs text-slate-500">{position.insight}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-sm text-slate-500">
                      <p>No benchmark data available</p>
                      <p className="text-xs mt-1">Fill in more context fields</p>
                    </div>
                  )}
                </div>
              )}

              {/* Recommendations View */}
              {viewMode === 'recommendations' && (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {recommendations.length > 0 ? (
                    recommendations.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3 border border-slate-700 rounded-lg space-y-2 cursor-pointer hover:bg-slate-800/50"
                        onClick={() => onRecommendationSelect?.(rec)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-slate-200">{rec.title}</span>
                          <div className="flex items-center gap-1">
                            <div className={`h-2 w-2 rounded-full ${getImpactColor(rec.impact)}`} />
                            <span className="text-xs text-slate-500 capitalize">
                              {rec.impact}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500">{rec.description}</p>

                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>
                            {rec.similarCompaniesUsingThis} companies
                          </span>
                          <span>
                            {Math.round(rec.successRate * 100)}% success
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-sm text-slate-500">
                      <p>No recommendations yet</p>
                      <p className="text-xs mt-1">Add similar companies to learn from</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default BenchmarksPanel;
