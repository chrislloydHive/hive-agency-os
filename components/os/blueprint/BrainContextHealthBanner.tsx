// components/os/blueprint/BrainContextHealthBanner.tsx
// Context Health Banner for Blueprint - shows BrainSummary data from Brain 4-Mode IA
//
// Displays:
// - Data confidence score
// - Domain health chips
// - Lab status indicators
// - Quick links to Brain

'use client';

import Link from 'next/link';
import { Brain, FlaskConical, AlertTriangle, ChevronRight } from 'lucide-react';
import type { BrainContextSummary } from './types';
import { getDomainHealthTier, getWeakDomains } from '@/lib/brain/summaryTypes';

interface BrainContextHealthBannerProps {
  brainContextSummary: BrainContextSummary;
  companyId: string;
}

export function BrainContextHealthBanner({
  brainContextSummary,
  companyId,
}: BrainContextHealthBannerProps) {
  const { dataConfidenceScore, domains, labs } = brainContextSummary;
  const weakDomains = getWeakDomains(domains, 70);
  const staleLabs = labs.filter(l => l.status === 'stale');
  const notRunLabs = labs.filter(l => l.status === 'not_run');

  // Color based on score
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getBannerStyle = (score: number) => {
    if (score >= 70) return 'bg-emerald-500/5 border-emerald-500/20';
    if (score >= 50) return 'bg-amber-500/5 border-amber-500/20';
    return 'bg-red-500/5 border-red-500/20';
  };

  const getTierStyle = (tier: ReturnType<typeof getDomainHealthTier>) => {
    switch (tier) {
      case 'strong':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'needs_work':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
    }
  };

  const getLabStatusStyle = (status: 'fresh' | 'stale' | 'not_run') => {
    switch (status) {
      case 'fresh':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'stale':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'not_run':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${getBannerStyle(dataConfidenceScore)}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Left: Score + Label */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-800/50">
            <Brain className={`w-5 h-5 ${getScoreColor(dataConfidenceScore)}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Context Confidence</span>
              <span className={`text-lg font-bold ${getScoreColor(dataConfidenceScore)}`}>
                {dataConfidenceScore}%
              </span>
            </div>
            {weakDomains.length > 0 && (
              <p className="text-[10px] text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                {weakDomains.length} domain{weakDomains.length > 1 ? 's' : ''} need attention
              </p>
            )}
          </div>
        </div>

        {/* Center: Domain Health Chips (top 4 weakest) */}
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {domains.slice(0, 6).map((domain) => {
            const tier = getDomainHealthTier(domain.healthScore);
            return (
              <Link
                key={domain.id}
                href={`/c/${companyId}/brain/context?section=${domain.id}`}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-medium transition-colors hover:opacity-80 ${getTierStyle(tier)}`}
              >
                <span className="text-slate-300">{domain.label}</span>
                <span>{domain.healthScore}%</span>
              </Link>
            );
          })}
          {domains.length > 6 && (
            <span className="text-[10px] text-slate-500">+{domains.length - 6} more</span>
          )}
        </div>

        {/* Right: Lab Status + Actions */}
        <div className="flex items-center gap-3">
          {/* Lab status indicators */}
          {(staleLabs.length > 0 || notRunLabs.length > 0) && (
            <div className="flex items-center gap-1.5">
              {staleLabs.length > 0 && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium ${getLabStatusStyle('stale')}`}>
                  <FlaskConical className="w-3 h-3" />
                  {staleLabs.length} stale
                </span>
              )}
              {notRunLabs.length > 0 && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium ${getLabStatusStyle('not_run')}`}>
                  <FlaskConical className="w-3 h-3" />
                  {notRunLabs.length} not run
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <Link
            href={`/c/${companyId}/brain/context`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-colors"
          >
            Review Context
            <ChevronRight className="w-3 h-3" />
          </Link>
          <Link
            href={`/c/${companyId}/brain/labs`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors"
          >
            Run Labs
            <FlaskConical className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
