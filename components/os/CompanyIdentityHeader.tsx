'use client';

// components/os/CompanyIdentityHeader.tsx
// ============================================================================
// Shared Company Identity Header
// ============================================================================
//
// A unified header component that displays company identity and key metrics
// using the CompanySummary data model. This component can be used across
// multiple pages (Overview, Blueprint, Brain, etc.) for consistent display.
//
// This component is designed to:
// 1. Accept either a full CompanySummary or individual props
// 2. Display company name, domain, stage, health status
// 3. Show key metrics: overall score, health, recent activity
// 4. Provide quick action buttons

import Link from 'next/link';
import type { CompanySummary, CompanySummaryMeta, CompanySummaryScores } from '@/lib/os/companySummary';

// ============================================================================
// Types
// ============================================================================

interface CompanyIdentityHeaderProps {
  // Option 1: Pass full CompanySummary
  summary?: CompanySummary;

  // Option 2: Pass individual props (for backward compatibility)
  companyId?: string;
  name?: string;
  domain?: string;
  website?: string;
  stage?: string;
  industry?: string;
  overallScore?: number | null;
  maturityStage?: string;
  healthTag?: string | null;

  // Layout options
  variant?: 'full' | 'compact';
  showActions?: boolean;
  showQuickHealthCheck?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-slate-500/10';
  if (score >= 70) return 'bg-emerald-500/10';
  if (score >= 40) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

function getHealthColor(health: string | null | undefined): { bg: string; text: string; border: string } {
  switch (health) {
    case 'Healthy':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'At Risk':
      return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' };
    default:
      return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' };
  }
}

function getMaturityStageStyle(stage: string | undefined | null): string {
  switch (stage) {
    case 'World-Class':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'Advanced':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'Good':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'Developing':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'Basic':
    default:
      return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
}

function getStageBadgeStyle(stage: string | null | undefined): string {
  switch (stage) {
    case 'Client':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'Prospect':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Internal':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}

// ============================================================================
// Component
// ============================================================================

export function CompanyIdentityHeader({
  summary,
  companyId,
  name,
  domain,
  website,
  stage,
  industry,
  overallScore,
  maturityStage,
  healthTag,
  variant = 'full',
  showActions = true,
  showQuickHealthCheck = false,
  className = '',
}: CompanyIdentityHeaderProps) {
  // Extract values from summary if provided, otherwise use individual props
  const id = summary?.companyId ?? companyId ?? '';
  const companyName = summary?.meta.name ?? name ?? 'Unknown Company';
  const companyDomain = summary?.meta.domain ?? domain;
  const companyWebsite = summary?.meta.url ?? website;
  const companyStage = summary?.meta.stage ?? stage;
  const companyHealth = summary?.meta.healthTag ?? healthTag;
  const score = summary?.scores.latestBlueprintScore ?? overallScore ?? null;
  const maturity = summary?.scores.maturityStage ?? maturityStage;
  const lastActivity = summary?.meta.lastActivityLabel;

  const healthColors = getHealthColor(companyHealth);

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        {/* Company Name + Stage */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-100 truncate">{companyName}</h1>
            {companyStage && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStageBadgeStyle(companyStage)}`}>
                {companyStage}
              </span>
            )}
          </div>
          {companyDomain && (
            <a
              href={companyWebsite?.startsWith('http') ? companyWebsite : `https://${companyDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              {companyDomain}
            </a>
          )}
        </div>

        {/* Score */}
        {score !== null && (
          <div className={`px-3 py-1.5 rounded-lg ${getScoreBgColor(score)}`}>
            <span className={`text-lg font-bold tabular-nums ${getScoreColor(score)}`}>{score}</span>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* Left: Company Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-100 truncate">{companyName}</h1>
            {maturity && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getMaturityStageStyle(maturity)}`}>
                {maturity}
              </span>
            )}
          </div>

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {companyDomain && (
              <a
                href={companyWebsite?.startsWith('http') ? companyWebsite : `https://${companyDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                {companyDomain}
              </a>
            )}
            {companyStage && (
              <span className={`px-2 py-0.5 rounded text-xs border ${getStageBadgeStyle(companyStage)}`}>
                {companyStage}
              </span>
            )}
            {industry && (
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">
                {industry}
              </span>
            )}
            {companyHealth && (
              <span className={`px-2 py-0.5 rounded text-xs border ${healthColors.bg} ${healthColors.text} ${healthColors.border}`}>
                {companyHealth}
              </span>
            )}
          </div>

          {/* Last Activity */}
          {lastActivity && (
            <p className="text-xs text-slate-500 mt-2">
              Last activity: {lastActivity}
            </p>
          )}
        </div>

        {/* Right: Score + Actions */}
        <div className="flex items-center gap-4">
          {/* Overall Score */}
          {score !== null && (
            <div className={`rounded-xl px-4 py-3 ${getScoreBgColor(score)}`}>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl font-bold tabular-nums ${getScoreColor(score)}`}>
                  {score}
                </span>
                <span className="text-sm text-slate-500">/100</span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Health Score</p>
            </div>
          )}

          {/* Quick Actions */}
          {showActions && id && (
            <div className="flex flex-col gap-2">
              <Link
                href={`/c/${id}/blueprint`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Blueprint
              </Link>
              <Link
                href={`/c/${id}/work`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Work
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Lightweight Mini Header
// ============================================================================

interface CompanyMiniHeaderProps {
  summary?: CompanySummary;
  companyId?: string;
  name?: string;
  score?: number | null;
  className?: string;
}

export function CompanyMiniHeader({
  summary,
  companyId,
  name,
  score,
  className = '',
}: CompanyMiniHeaderProps) {
  const id = summary?.companyId ?? companyId ?? '';
  const companyName = summary?.meta.name ?? name ?? 'Unknown';
  const companyScore = summary?.scores.latestBlueprintScore ?? score ?? null;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-3">
        <Link
          href={`/c/${id}/blueprint`}
          className="text-sm font-semibold text-slate-100 hover:text-white transition-colors"
        >
          {companyName}
        </Link>
      </div>
      {companyScore !== null && (
        <span className={`text-sm font-bold tabular-nums ${getScoreColor(companyScore)}`}>
          {companyScore}
        </span>
      )}
    </div>
  );
}

export default CompanyIdentityHeader;
