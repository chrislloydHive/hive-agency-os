'use client';

// components/plan/PriorityView.tsx
// Findings organized by priority/severity lanes
//
// Shows findings in four horizontal swimlanes:
// - Critical
// - High
// - Medium
// - Low

import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, Minus } from 'lucide-react';
import { FindingCard } from './FindingCard';
import { clusterByPriority } from './themeCluster';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

interface PriorityViewProps {
  findings: DiagnosticDetailFinding[];
  onConvert: (finding: DiagnosticDetailFinding) => Promise<void>;
  onSelectFinding: (finding: DiagnosticDetailFinding) => void;
}

// ============================================================================
// Priority Lane Config
// ============================================================================

const priorityConfig: Record<string, {
  label: string;
  description: string;
  icon: React.ElementType;
  colors: { bg: string; border: string; iconBg: string; text: string };
}> = {
  critical: {
    label: 'Critical',
    description: 'Immediate attention required',
    icon: AlertCircle,
    colors: {
      bg: 'bg-red-500/5',
      border: 'border-red-500/30',
      iconBg: 'bg-red-500/20',
      text: 'text-red-400',
    },
  },
  high: {
    label: 'High',
    description: 'Address this quarter',
    icon: AlertTriangle,
    colors: {
      bg: 'bg-orange-500/5',
      border: 'border-orange-500/30',
      iconBg: 'bg-orange-500/20',
      text: 'text-orange-400',
    },
  },
  medium: {
    label: 'Medium',
    description: 'Plan for next quarter',
    icon: Info,
    colors: {
      bg: 'bg-yellow-500/5',
      border: 'border-yellow-500/30',
      iconBg: 'bg-yellow-500/20',
      text: 'text-yellow-400',
    },
  },
  low: {
    label: 'Low',
    description: 'Nice to have improvements',
    icon: Minus,
    colors: {
      bg: 'bg-slate-500/5',
      border: 'border-slate-500/30',
      iconBg: 'bg-slate-500/20',
      text: 'text-slate-400',
    },
  },
};

// ============================================================================
// Priority Lane Component
// ============================================================================

function PriorityLane({
  priority,
  findings,
  onConvert,
  onSelectFinding,
}: {
  priority: string;
  findings: DiagnosticDetailFinding[];
  onConvert: (finding: DiagnosticDetailFinding) => Promise<void>;
  onSelectFinding: (finding: DiagnosticDetailFinding) => void;
}) {
  const config = priorityConfig[priority] || priorityConfig.medium;
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.colors.border} ${config.colors.bg} overflow-hidden`}>
      {/* Lane Header */}
      <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${config.colors.iconBg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${config.colors.text}`} />
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${config.colors.text}`}>{config.label}</h3>
            <p className="text-xs text-slate-500">{config.description}</p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
          {findings.length}
        </span>
      </div>

      {/* Findings */}
      <div className="p-3">
        {findings.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500">
            No {config.label.toLowerCase()} findings
          </div>
        ) : (
          <div className="space-y-2">
            {findings.map(finding => (
              <FindingCard
                key={finding.id}
                finding={finding}
                onConvert={onConvert}
                onSelect={onSelectFinding}
                compact
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PriorityView({ findings, onConvert, onSelectFinding }: PriorityViewProps) {
  // Cluster findings by priority
  const priorityClusters = useMemo(() => clusterByPriority(findings), [findings]);

  if (findings.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto text-slate-600 mb-4" />
        <p className="text-slate-400">No findings to prioritize.</p>
        <p className="text-sm text-slate-500 mt-1">Run diagnostics to discover issues and opportunities.</p>
      </div>
    );
  }

  // Priority order
  const priorities = ['critical', 'high', 'medium', 'low'];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {priorities.map(priority => (
        <PriorityLane
          key={priority}
          priority={priority}
          findings={priorityClusters.get(priority) || []}
          onConvert={onConvert}
          onSelectFinding={onSelectFinding}
        />
      ))}
    </div>
  );
}

export default PriorityView;
