'use client';

// components/pipeline/PipelineAlertsSection.tsx
// Compact alerts section showing pipeline items that need attention

import { useState, useEffect, useCallback } from 'react';
import type {
  PipelineAlertsData,
  PipelineAlertType,
} from '@/lib/types/pipeline';
import {
  getAlertLabel,
  getAlertColorClasses,
} from '@/lib/types/pipeline';

// Format currency
const formatCurrency = (num: number) => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
};

// Alert icons
const ALERT_ICONS: Record<PipelineAlertType, string> = {
  overdueNextSteps: '⚠️',
  stalledDeals: '⏸️',
  rfpDueSoon: '📋',
};

interface PipelineAlertsSectionProps {
  /** Currently selected alert type (controlled) */
  selectedAlert?: PipelineAlertType | null;
  /** Callback when an alert is clicked */
  onAlertClick?: (alertType: PipelineAlertType, opportunityIds: string[]) => void;
}

export function PipelineAlertsSection({
  selectedAlert: controlledSelectedAlert,
  onAlertClick,
}: PipelineAlertsSectionProps) {
  const [alerts, setAlerts] = useState<PipelineAlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Internal selection state (used if not controlled)
  const [internalSelectedAlert, setInternalSelectedAlert] = useState<PipelineAlertType | null>(null);

  // Use controlled or internal selection
  const selectedAlert = controlledSelectedAlert !== undefined ? controlledSelectedAlert : internalSelectedAlert;

  // Fetch alerts data
  useEffect(() => {
    async function fetchAlerts() {
      try {
        setLoading(true);
        const response = await fetch('/api/os/pipeline/alerts');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch alerts');
        }

        setAlerts(data.alerts);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, []);

  // Handle alert click
  const handleAlertClick = useCallback(
    (alertType: PipelineAlertType, opportunityIds: string[]) => {
      // Toggle internal state if not controlled
      if (controlledSelectedAlert === undefined) {
        setInternalSelectedAlert(internalSelectedAlert === alertType ? null : alertType);
      }
      onAlertClick?.(alertType, opportunityIds);
    },
    [controlledSelectedAlert, internalSelectedAlert, onAlertClick]
  );

  if (loading) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
        <div className="animate-pulse flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-16 bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/70 border border-red-500/30 rounded-xl p-4">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  if (!alerts) return null;

  // Check if there are any alerts
  const totalAlerts =
    alerts.overdueNextSteps.count +
    alerts.stalledDeals.count +
    alerts.rfpDueSoon.count;

  if (totalAlerts === 0) {
    return (
      <div className="bg-slate-900/70 border border-emerald-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">✓</span>
          <span className="text-sm text-slate-300">No pipeline alerts</span>
          <span className="text-xs text-slate-500">— all deals on track</span>
        </div>
      </div>
    );
  }

  const alertTypes: PipelineAlertType[] = ['overdueNextSteps', 'stalledDeals', 'rfpDueSoon'];

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Pipeline Alerts
        </h3>
        <span className="text-xs text-slate-500">{totalAlerts} items need attention</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {alertTypes.map((alertType) => {
          const alertData = alerts[alertType];
          const isSelected = selectedAlert === alertType;
          const hasItems = alertData.count > 0;

          return (
            <button
              key={alertType}
              onClick={() => hasItems && handleAlertClick(alertType, alertData.opportunityIds)}
              disabled={!hasItems}
              className={`text-left p-3 rounded-lg border transition-all ${
                !hasItems
                  ? 'opacity-40 cursor-not-allowed bg-slate-800/30 border-slate-800'
                  : isSelected
                    ? 'ring-2 ring-amber-500/50 ' + getAlertColorClasses(alertType)
                    : getAlertColorClasses(alertType) + ' hover:opacity-80 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <span>{ALERT_ICONS[alertType]}</span>
                  {getAlertLabel(alertType)}
                </span>
                <span className="text-xs px-1.5 py-0.5 bg-black/20 rounded">
                  {alertData.count}
                </span>
              </div>
              <div className="text-sm font-semibold">
                {formatCurrency(alertData.totalValue)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
