'use client';

// components/reports/QBRScoreStrip.tsx
// QBR Score Strip - Full-width band with health score ring, component scores, and snapshot chips

import { HealthScoreRing } from '@/components/qbr/HealthScoreRing';
import { Activity, ClipboardList, Brain, AlertTriangle, FileSearch } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface QBRScoreStripProps {
  healthScore: number;
  diagnosticsScore: number | null;
  contextScore: number | null;
  activeWorkItems: number;
  unresolvedFindings: number;
  diagnosticModulesCount?: number;
  workConversionRate?: number;
}

// ============================================================================
// Helpers
// ============================================================================

function getStatusLabel(score: number): { label: string; color: string } {
  if (score >= 80) {
    return { label: 'Strong', color: 'text-emerald-400' };
  }
  if (score >= 60) {
    return { label: 'On track', color: 'text-blue-400' };
  }
  if (score >= 40) {
    return { label: 'Needs attention', color: 'text-amber-400' };
  }
  return { label: 'At risk', color: 'text-red-400' };
}

// ============================================================================
// Mini Score Card Component
// ============================================================================

interface MiniScoreCardProps {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string | number;
  suffix?: string;
  sublabel?: string;
}

function MiniScoreCard({ icon: Icon, iconColor, label, value, suffix, sublabel }: MiniScoreCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <div className={`p-2 rounded-lg ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-lg font-bold text-slate-100 tabular-nums">
          {value}
          {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
        </div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
        {sublabel && <div className="text-[10px] text-slate-400">{sublabel}</div>}
      </div>
    </div>
  );
}

// ============================================================================
// Snapshot Chip Component
// ============================================================================

interface SnapshotChipProps {
  label: string;
  highlight?: boolean;
}

function SnapshotChip({ label, highlight }: SnapshotChipProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium ${
        highlight
          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          : 'bg-slate-800 text-slate-400 border border-slate-700/50'
      }`}
    >
      {label}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function QBRScoreStrip({
  healthScore,
  diagnosticsScore,
  contextScore,
  activeWorkItems,
  unresolvedFindings,
  diagnosticModulesCount = 0,
  workConversionRate = 0,
}: QBRScoreStripProps) {
  const status = getStatusLabel(healthScore);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 md:p-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Column 1: Overall Marketing Health */}
        <div className="flex items-center gap-6">
          <HealthScoreRing score={healthScore} size="large" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-100">Marketing Health</h3>
            <p className={`text-sm font-medium ${status.color}`}>{status.label}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Weighted across diagnostics, work, and context.
            </p>
          </div>
        </div>

        {/* Column 2: Component Scores */}
        <div className="grid grid-cols-2 gap-3">
          <MiniScoreCard
            icon={Activity}
            iconColor="bg-purple-500/10 text-purple-400"
            label="Diagnostics"
            value={diagnosticsScore ?? '\u2014'}
            suffix={diagnosticsScore !== null ? '%' : undefined}
          />
          <MiniScoreCard
            icon={Brain}
            iconColor="bg-cyan-500/10 text-cyan-400"
            label="Context"
            value={contextScore ?? '\u2014'}
            suffix={contextScore !== null ? '%' : undefined}
          />
          <MiniScoreCard
            icon={ClipboardList}
            iconColor="bg-emerald-500/10 text-emerald-400"
            label="Active Work"
            value={activeWorkItems}
            sublabel="in progress"
          />
          <MiniScoreCard
            icon={FileSearch}
            iconColor="bg-amber-500/10 text-amber-400"
            label="Findings"
            value={unresolvedFindings}
            sublabel="unresolved"
          />
        </div>

        {/* Column 3: Snapshot Chips */}
        <div className="flex flex-col justify-center gap-2">
          <h4 className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Quick Stats</h4>
          <div className="flex flex-wrap gap-2">
            {diagnosticsScore !== null && diagnosticModulesCount > 0 && (
              <SnapshotChip label={`Diagnostics: ${diagnosticsScore}% across ${diagnosticModulesCount} modules`} />
            )}
            {unresolvedFindings > 0 && (
              <SnapshotChip label={`Open findings: ${unresolvedFindings}`} highlight={unresolvedFindings > 5} />
            )}
            {workConversionRate !== undefined && (
              <SnapshotChip
                label={`Work conversion: ${workConversionRate}%`}
                highlight={workConversionRate < 20}
              />
            )}
            {contextScore !== null && (
              <SnapshotChip
                label={`Context coverage: ${contextScore}%`}
                highlight={contextScore < 50}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
