'use client';

// components/os/programs/ServiceCoveragePanel.tsx
// Shows service coverage for a program
//
// Displays:
// - Services used by the program (checkmark)
// - Available services not used (dimmed)
// - Capability gaps (warning icon)

import React from 'react';
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Wrench,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ServiceCoverage } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

interface ServiceCoveragePanelProps {
  serviceCoverage: ServiceCoverage | undefined;
  availableServices?: string[];
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ServiceCoveragePanel({
  serviceCoverage,
  availableServices = [],
  isLoading = false,
}: ServiceCoveragePanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-purple-400">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Analyzing service coverage...</span>
        </div>
      </div>
    );
  }

  // No coverage data and no available services
  if (!serviceCoverage && availableServices.length === 0) {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Wrench className="w-4 h-4" />
          <span className="text-sm">No service coverage data available</span>
        </div>
      </div>
    );
  }

  // Use the actual coverage or defaults
  const servicesUsed = serviceCoverage?.servicesUsed ?? [];
  const unusedServices = serviceCoverage?.unusedServices ?? [];
  const gaps = serviceCoverage?.gaps ?? [];

  // Calculate totals
  const totalUsed = servicesUsed.length;
  const totalUnused = unusedServices.length;
  const totalGaps = gaps.length;
  const totalAvailable = totalUsed + totalUnused;

  // Determine color based on gaps
  const hasGaps = totalGaps > 0;
  const borderColor = hasGaps
    ? 'border-amber-500/20'
    : totalUsed > 0
    ? 'border-purple-500/20'
    : 'border-slate-700/50';
  const bgColor = hasGaps
    ? 'bg-amber-500/5'
    : totalUsed > 0
    ? 'bg-purple-500/5'
    : 'bg-slate-800/30';
  const headerColor = hasGaps ? 'text-amber-400' : 'text-purple-400';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wrench className={`w-4 h-4 ${headerColor}`} />
          <h4 className="text-sm font-medium text-white">Hive Services</h4>
          {totalUsed > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
              {totalUsed} used
            </span>
          )}
          {hasGaps && (
            <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {totalGaps} gap{totalGaps > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Collapsed summary */}
      {!isExpanded && (totalUsed > 0 || hasGaps) && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-slate-400">
            {totalUsed > 0 && `${totalUsed} of ${totalAvailable} services used`}
            {totalUsed > 0 && hasGaps && ' · '}
            {hasGaps && `${totalGaps} capability gap${totalGaps > 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-700/50">
          {/* Services Used */}
          {servicesUsed.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Services Used
              </h5>
              <ul className="space-y-1.5">
                {servicesUsed.map((service, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-slate-200">{service}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unused Services */}
          {unusedServices.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-700/30">
              <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Available (Not Used)
              </h5>
              <ul className="space-y-1.5">
                {unusedServices.map((service, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <span className="text-sm text-slate-500">{service}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Capability Gaps */}
          {gaps.length > 0 && (
            <div className="px-4 py-3">
              <h5 className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Capability Gaps
              </h5>
              <ul className="space-y-1.5">
                {gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-amber-200">{gap}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-3">
                These capabilities are needed but not currently available in your service package.
              </p>
            </div>
          )}

          {/* Empty state */}
          {servicesUsed.length === 0 && unusedServices.length === 0 && gaps.length === 0 && (
            <div className="px-4 py-3 text-center">
              <p className="text-sm text-slate-400">
                Run AI planning to analyze service coverage.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
