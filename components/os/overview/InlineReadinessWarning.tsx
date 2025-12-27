'use client';

// components/os/overview/InlineReadinessWarning.tsx
// Inline Readiness Warning - Shows quality warnings from AI Readiness
//
// Surfaces concise warnings when Readiness has WARN/ERROR signals.
// Used in Strategy creation and Deliverables cards.

import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { V4HealthResponse } from '@/lib/types/contextV4Health';

// ============================================================================
// Types
// ============================================================================

interface InlineReadinessWarningProps {
  companyId: string;
  /** Context where warning is shown */
  context: 'strategy' | 'deliverable';
}

interface WarningMessage {
  message: string;
  severity: 'warn' | 'error';
}

// ============================================================================
// Component
// ============================================================================

export function InlineReadinessWarning({
  companyId,
  context,
}: InlineReadinessWarningProps) {
  const [warnings, setWarnings] = useState<WarningMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Use ref to avoid re-creating callback when context changes
  const contextRef = useRef(context);
  contextRef.current = context;

  // Track if component is mounted
  const mountedRef = useRef(true);

  const fetchWarnings = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/context/v4/health`,
        { cache: 'no-store' }
      );

      // Check if still mounted
      if (!mountedRef.current) return;

      if (!response.ok) {
        setLoading(false);
        return;
      }

      const health: V4HealthResponse = await response.json();
      const newWarnings: WarningMessage[] = [];
      const ctx = contextRef.current;

      // Check for missing or stale labs
      if (!health.websiteLab?.hasRun) {
        newWarnings.push({
          message:
            ctx === 'strategy'
              ? 'Strategy quality may be reduced until Website Lab is run.'
              : 'Deliverable quality may be reduced until Website Lab is run.',
          severity: 'warn',
        });
      } else if (health.reasons.includes('WEBSITELAB_STALE')) {
        newWarnings.push({
          message: 'Website Lab data is stale. Consider re-running for best results.',
          severity: 'warn',
        });
      }

      // Check for V4 store issues
      if (health.reasons.includes('NO_V4_STORE')) {
        newWarnings.push({
          message: 'Context store is unavailable. AI features may be limited.',
          severity: 'error',
        });
      }

      // Check for low proposal counts
      if (
        health.store?.confirmed === 0 &&
        health.store?.proposed === 0 &&
        health.websiteLab?.hasRun
      ) {
        newWarnings.push({
          message: 'No context fields extracted. Check lab output or re-run.',
          severity: 'warn',
        });
      }

      if (mountedRef.current) {
        setWarnings(newWarnings);
      }
    } catch (err) {
      console.error('[InlineReadinessWarning] Error:', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [companyId]); // Only depend on companyId, use ref for context

  useEffect(() => {
    mountedRef.current = true;
    fetchWarnings();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchWarnings]);

  // Don't show anything while loading or if no warnings
  if (loading || warnings.length === 0) {
    return null;
  }

  // Show the first/most important warning
  const primaryWarning = warnings[0];
  const severityStyles =
    primaryWarning.severity === 'error'
      ? 'bg-red-500/5 border-red-500/20 text-red-400/90'
      : 'bg-amber-500/5 border-amber-500/20 text-amber-400/80';

  return (
    <div className={`mt-3 p-2.5 rounded-lg border ${severityStyles}`}>
      <div className="flex items-start gap-2 text-xs">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{primaryWarning.message}</span>
      </div>
    </div>
  );
}

export default InlineReadinessWarning;
