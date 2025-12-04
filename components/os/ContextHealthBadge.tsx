'use client';

// components/os/ContextHealthBadge.tsx
// Compact Context Health Badge for headers/toolbars
//
// Shows a small health score indicator with color coding.
// Can be used in various places where a full card is too large.

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Simple cn utility for combining class names
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Types
// ============================================================================

interface ContextHealthBadgeProps {
  companyId: string;
  className?: string;
  showLabel?: boolean;
  linkToDebug?: boolean;
}

interface HealthData {
  healthScore?: number;
  healthStatus?: 'healthy' | 'fair' | 'needs_attention' | 'critical';
  completenessScore?: number;
  needsRefresh?: Array<{ domain: string; field: string; reason: string }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHealthColor(score: number | null | undefined): string {
  if (score == null) return 'text-slate-400';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  if (score >= 25) return 'text-orange-400';
  return 'text-red-400';
}

function getHealthBgColor(score: number | null | undefined): string {
  if (score == null) return 'bg-slate-500/20';
  if (score >= 75) return 'bg-emerald-500/20';
  if (score >= 50) return 'bg-amber-500/20';
  if (score >= 25) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextHealthBadge({
  companyId,
  className,
  showLabel = true,
  linkToDebug = true,
}: ContextHealthBadgeProps) {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHealth() {
      try {
        setLoading(true);
        const response = await fetch(`/api/os/companies/${companyId}/context-health`);

        if (!response.ok) {
          setHealthData(null);
          return;
        }

        const data = await response.json();
        setHealthData(data);
      } catch (err) {
        console.error('[ContextHealthBadge] Error:', err);
        setHealthData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchHealth();
  }, [companyId]);

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showLabel && (
          <span className="text-xs text-slate-500">Context:</span>
        )}
        <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-slate-400 animate-spin" />
      </div>
    );
  }

  // No data
  if (!healthData) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showLabel && (
          <span className="text-xs text-slate-500">Context:</span>
        )}
        <span className="text-xs text-slate-500">—</span>
      </div>
    );
  }

  const score = healthData.healthScore ?? healthData.completenessScore;
  const textColor = getHealthColor(score);
  const bgColor = getHealthBgColor(score);
  const needsAttention = healthData.needsRefresh && healthData.needsRefresh.length > 0;

  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className="text-xs text-slate-400">Context Health:</span>
      )}
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          bgColor,
          textColor
        )}
      >
        {score != null ? `${score}%` : '—'}
        {needsAttention && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </span>
    </div>
  );

  if (linkToDebug) {
    return (
      <Link
        href={`/c/${companyId}/debug`}
        className="hover:opacity-80 transition-opacity"
        title="View context graph details"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export default ContextHealthBadge;
