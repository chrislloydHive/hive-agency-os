'use client';

// components/os/decide/DecideShell.tsx
// DecideShell - Persistent wrapper for all Decide phase pages
//
// Provides consistent sub-navigation (Context | Strategy | Review) across:
// - /c/[companyId]/decide
// - /c/[companyId]/context (and subviews)
// - /c/[companyId]/strategy
// - /c/[companyId]/readiness (optional, under Decide umbrella)
//
// Navigation handler routes to actual pages rather than hash-based switching.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { DecideSubNav } from './DecideSubNav';
import {
  getDecideUIState,
  sanitizeActiveSubView,
  type DecideUIState,
  type DecideDataInput,
  type DecideSubView,
} from '@/lib/os/ui/decideUiState';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';

// ============================================================================
// Types
// ============================================================================

interface DecideShellProps {
  companyId: string;
  /** Active sub-view to highlight in nav */
  activeSubView: DecideSubView;
  /** Child content to render below the sub-nav */
  children: React.ReactNode;
  /** Optional: pre-loaded UI state (for DecideClient which already has it) */
  preloadedUIState?: DecideUIState;
}

// ============================================================================
// Component
// ============================================================================

export function DecideShell({
  companyId,
  activeSubView,
  children,
  preloadedUIState,
}: DecideShellProps) {
  const router = useRouter();

  // If preloadedUIState is provided, use it directly
  // Otherwise, fetch the data needed to compute UI state
  const [contextHealth, setContextHealth] = useState<V4HealthResponse | null>(null);
  const [strategyExists, setStrategyExists] = useState(false);
  const [strategyLocked, setStrategyLocked] = useState(false);
  const [loading, setLoading] = useState(!preloadedUIState);

  useEffect(() => {
    // Skip fetch if preloaded state is provided
    if (preloadedUIState) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [healthRes, strategyRes] = await Promise.all([
          fetch(`/api/os/companies/${companyId}/context/v4/health`, {
            cache: 'no-store',
          }).catch(() => null),
          fetch(`/api/os/companies/${companyId}/strategy/view-model`, {
            cache: 'no-store',
          }).catch(() => null),
        ]);

        if (healthRes?.ok) {
          const health = await healthRes.json();
          setContextHealth(health);
        }

        if (strategyRes?.ok) {
          const data = await strategyRes.json();
          setStrategyExists(!!data.strategy?.id);
          setStrategyLocked(data.strategy?.locked ?? false);
        }
      } catch (err) {
        console.error('[DecideShell] Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, preloadedUIState]);

  // Derive UI state from selector (or use preloaded)
  const uiState: DecideUIState = preloadedUIState ?? getDecideUIState(
    { contextHealth, strategyExists, strategyLocked },
    companyId
  );

  // Sanitize active sub-view in case it's not available
  const sanitizedActiveSubView = sanitizeActiveSubView(activeSubView, uiState);

  // Navigation handler - routes to actual pages
  const handleSubViewChange = useCallback((newSubView: DecideSubView) => {
    // Sanitize first
    const sanitized = sanitizeActiveSubView(newSubView, uiState);

    // Navigate based on sub-view
    switch (sanitized) {
      case 'context':
        router.push(`/c/${companyId}/context`);
        break;
      case 'strategy':
        router.push(`/c/${companyId}/strategy`);
        break;
      case 'review':
        // Review lives on the decide page with hash
        router.push(`/c/${companyId}/decide#review`);
        break;
    }
  }, [companyId, router, uiState]);

  // Loading state - show minimal shell
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-Navigation */}
      <DecideSubNav
        subNav={uiState.subNav}
        activeSubView={sanitizedActiveSubView}
        onChange={handleSubViewChange}
      />

      {/* Dev-only UI state debug indicator */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="text-[10px] font-mono text-slate-500 bg-slate-900/50 border border-slate-800/50 rounded px-2 py-1">
          <span className="text-cyan-400">{uiState.state}</span>
          <span className="mx-2">|</span>
          subView: <span className="text-purple-400">{sanitizedActiveSubView}</span>
          <span className="mx-2">|</span>
          available: [
          {Object.entries(uiState.subNav.available)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ')}
          ]
        </div>
      )}

      {/* Page Content */}
      {children}
    </div>
  );
}

export default DecideShell;
