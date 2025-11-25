'use client';

// components/os/HiveOsBriefingCard.tsx
// AI-powered daily briefing card for Hive OS dashboard

import React from 'react';
import Link from 'next/link';
import type {
  AIBriefing,
  BriefingFocusArea,
  BriefingFocusItem,
} from '@/app/api/os/dashboard/ai-briefing/route';

// ============================================================================
// Types
// ============================================================================

interface HiveOsBriefingCardProps {
  briefing: AIBriefing | null;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Area Config
// ============================================================================

const AREA_CONFIG: Record<
  BriefingFocusArea,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  clients: {
    label: 'Clients',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    icon: '👥',
  },
  work: {
    label: 'Work',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    icon: '📋',
  },
  pipeline: {
    label: 'Pipeline',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    icon: '💰',
  },
  analytics: {
    label: 'Analytics',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    icon: '📊',
  },
  diagnostics: {
    label: 'Diagnostics',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    icon: '🔬',
  },
};

// ============================================================================
// Subcomponents
// ============================================================================

function BriefingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-700" />
        <div className="h-6 w-48 rounded bg-slate-700" />
      </div>

      {/* Headline skeleton */}
      <div className="h-7 w-3/4 rounded bg-slate-700" />

      {/* Summary skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-slate-700" />
        <div className="h-4 w-5/6 rounded bg-slate-700" />
      </div>

      {/* Focus items skeleton */}
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50">
            <div className="w-16 h-5 rounded bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-700" />
              <div className="h-3 w-full rounded bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusItem({ item }: { item: BriefingFocusItem }) {
  const config = AREA_CONFIG[item.area];

  const content = (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group">
      {/* Area chip */}
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-slate-100 truncate">
            {item.title}
          </h4>
          {item.linkHref && (
            <svg
              className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.detail}</p>
      </div>
    </div>
  );

  if (item.linkHref) {
    return (
      <Link href={item.linkHref} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

function RiskOrOpportunityItem({
  item,
  type,
}: {
  item: { title: string; detail: string };
  type: 'risk' | 'opportunity';
}) {
  const isRisk = type === 'risk';

  return (
    <div
      className={`p-3 rounded-lg ${
        isRisk ? 'bg-red-500/5 border border-red-500/20' : 'bg-green-500/5 border border-green-500/20'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`text-sm ${isRisk ? 'text-red-400' : 'text-green-400'}`}>
          {isRisk ? '⚠️' : '✨'}
        </span>
        <div>
          <h4
            className={`text-sm font-medium ${
              isRisk ? 'text-red-300' : 'text-green-300'
            }`}
          >
            {item.title}
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">{item.detail}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function HiveOsBriefingCard({
  briefing,
  loading,
  error,
}: HiveOsBriefingCardProps) {
  // Loading state
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm text-slate-400">Generating today's briefing...</span>
        </div>
        <BriefingSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <span className="text-red-400">⚠️</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">
              Briefing Unavailable
            </h3>
            <p className="text-sm text-slate-400">
              {error || 'Unable to generate briefing'}
            </p>
          </div>
        </div>
        <p className="text-sm text-slate-500">
          The dashboard data is still available below. Check the individual sections
          for details.
        </p>
      </div>
    );
  }

  // No briefing yet (fallback state)
  if (!briefing) {
    return (
      <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-6">
        <div className="text-sm text-slate-400">
          <p className="mb-3">
            AI briefing will analyze your dashboard data and provide:
          </p>
          <ul className="space-y-1 text-slate-500">
            <li>• Today's focus priorities</li>
            <li>• Opportunities to pursue</li>
            <li>• Risks to address</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
          <span className="text-amber-400">🐝</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Hive OS Briefing</h3>
          <p className="text-xs text-slate-500">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Headline */}
      <h2 className="text-xl font-bold text-slate-50 mb-3">{briefing.headline}</h2>

      {/* Summary */}
      <p className="text-sm text-slate-300 leading-relaxed mb-6">
        {briefing.summary}
      </p>

      {/* Today's Focus */}
      {briefing.todayFocus.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Today's Focus
          </h4>
          <div className="space-y-2">
            {briefing.todayFocus.map((item, index) => (
              <FocusItem key={index} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Risks & Opportunities Grid */}
      {(briefing.risks.length > 0 || briefing.opportunities.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Risks */}
          {briefing.risks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                Risks to Watch
              </h4>
              <div className="space-y-2">
                {briefing.risks.map((risk, index) => (
                  <RiskOrOpportunityItem key={index} item={risk} type="risk" />
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {briefing.opportunities.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">
                Opportunities
              </h4>
              <div className="space-y-2">
                {briefing.opportunities.map((opp, index) => (
                  <RiskOrOpportunityItem key={index} item={opp} type="opportunity" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HiveOsBriefingCard;
