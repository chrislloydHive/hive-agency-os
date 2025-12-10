'use client';

// components/plan/LabView.tsx
// Findings grouped by diagnostic lab source
//
// Shows findings organized by which lab discovered them:
// - Website Lab
// - Brand Lab
// - SEO Lab
// etc.

import { useMemo } from 'react';
import {
  Globe,
  Sparkles,
  Search,
  FileText,
  BarChart3,
  TrendingUp,
  Settings,
  Zap,
} from 'lucide-react';
import { FindingCard } from './FindingCard';
import { clusterByLab } from './themeCluster';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

interface LabViewProps {
  findings: DiagnosticDetailFinding[];
  onConvert: (finding: DiagnosticDetailFinding) => Promise<void>;
  onSelectFinding: (finding: DiagnosticDetailFinding) => void;
}

// ============================================================================
// Lab Config
// ============================================================================

const labConfig: Record<string, {
  label: string;
  icon: React.ElementType;
  colors: { bg: string; border: string; iconBg: string; text: string };
}> = {
  website: {
    label: 'Website Lab',
    icon: Globe,
    colors: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/20',
      iconBg: 'bg-blue-500/20',
      text: 'text-blue-400',
    },
  },
  brand: {
    label: 'Brand Lab',
    icon: Sparkles,
    colors: {
      bg: 'bg-pink-500/5',
      border: 'border-pink-500/20',
      iconBg: 'bg-pink-500/20',
      text: 'text-pink-400',
    },
  },
  seo: {
    label: 'SEO Lab',
    icon: Search,
    colors: {
      bg: 'bg-cyan-500/5',
      border: 'border-cyan-500/20',
      iconBg: 'bg-cyan-500/20',
      text: 'text-cyan-400',
    },
  },
  content: {
    label: 'Content Lab',
    icon: FileText,
    colors: {
      bg: 'bg-emerald-500/5',
      border: 'border-emerald-500/20',
      iconBg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
    },
  },
  demand: {
    label: 'Demand Lab',
    icon: TrendingUp,
    colors: {
      bg: 'bg-orange-500/5',
      border: 'border-orange-500/20',
      iconBg: 'bg-orange-500/20',
      text: 'text-orange-400',
    },
  },
  ops: {
    label: 'Ops Lab',
    icon: Settings,
    colors: {
      bg: 'bg-purple-500/5',
      border: 'border-purple-500/20',
      iconBg: 'bg-purple-500/20',
      text: 'text-purple-400',
    },
  },
  gap: {
    label: 'GAP Assessment',
    icon: Zap,
    colors: {
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/20',
      iconBg: 'bg-amber-500/20',
      text: 'text-amber-400',
    },
  },
  unknown: {
    label: 'Other',
    icon: BarChart3,
    colors: {
      bg: 'bg-slate-500/5',
      border: 'border-slate-500/20',
      iconBg: 'bg-slate-500/20',
      text: 'text-slate-400',
    },
  },
};

// ============================================================================
// Lab Section Component
// ============================================================================

function LabSection({
  lab,
  findings,
  onConvert,
  onSelectFinding,
}: {
  lab: string;
  findings: DiagnosticDetailFinding[];
  onConvert: (finding: DiagnosticDetailFinding) => Promise<void>;
  onSelectFinding: (finding: DiagnosticDetailFinding) => void;
}) {
  const config = labConfig[lab.toLowerCase()] || labConfig.unknown;
  const Icon = config.icon;

  // Count high priority
  const highPriorityCount = findings.filter(
    f => f.severity === 'critical' || f.severity === 'high'
  ).length;

  return (
    <div className={`rounded-xl border ${config.colors.border} ${config.colors.bg} overflow-hidden`}>
      {/* Lab Header */}
      <div className="px-4 py-3 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${config.colors.iconBg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${config.colors.text}`} />
          </div>
          <h3 className={`text-sm font-semibold ${config.colors.text}`}>{config.label}</h3>
        </div>
        <div className="flex items-center gap-2">
          {highPriorityCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
              {highPriorityCount} urgent
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
            {findings.length}
          </span>
        </div>
      </div>

      {/* Findings */}
      <div className="p-3 grid gap-2 sm:grid-cols-2">
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
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LabView({ findings, onConvert, onSelectFinding }: LabViewProps) {
  // Cluster findings by lab
  const labClusters = useMemo(() => clusterByLab(findings), [findings]);

  if (findings.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 mx-auto text-slate-600 mb-4" />
        <p className="text-slate-400">No findings to display.</p>
        <p className="text-sm text-slate-500 mt-1">Run diagnostics to discover issues and opportunities.</p>
      </div>
    );
  }

  // Sort labs by finding count
  const sortedLabs = Array.from(labClusters.entries())
    .filter(([, findings]) => findings.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sortedLabs.map(([lab, labFindings]) => (
        <LabSection
          key={lab}
          lab={lab}
          findings={labFindings}
          onConvert={onConvert}
          onSelectFinding={onSelectFinding}
        />
      ))}
    </div>
  );
}

export default LabView;
