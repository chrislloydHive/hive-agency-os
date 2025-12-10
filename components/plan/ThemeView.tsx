'use client';

// components/plan/ThemeView.tsx
// Findings grouped by strategic themes
//
// Shows findings organized into meaningful categories like:
// - Website Clarity & Conversion
// - Brand Positioning & Messaging
// - SEO Visibility & Structure
// etc.

import { useMemo } from 'react';
import {
  Globe,
  Sparkles,
  Search,
  FileText,
  BarChart3,
  TrendingUp,
  Lightbulb,
} from 'lucide-react';
import { FindingCard } from './FindingCard';
import { getNonEmptyThemes, type Theme } from './themeCluster';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

interface ThemeViewProps {
  findings: DiagnosticDetailFinding[];
  onConvert: (finding: DiagnosticDetailFinding) => Promise<void>;
  onSelectFinding: (finding: DiagnosticDetailFinding) => void;
}

// ============================================================================
// Icon Map
// ============================================================================

const iconMap: Record<string, React.ElementType> = {
  Globe,
  Sparkles,
  Search,
  FileText,
  BarChart3,
  TrendingUp,
  Lightbulb,
};

// ============================================================================
// Color Classes
// ============================================================================

const colorClasses: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', iconBg: 'bg-blue-500/20' },
  pink: { bg: 'bg-pink-500/5', border: 'border-pink-500/20', text: 'text-pink-400', iconBg: 'bg-pink-500/20' },
  cyan: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', text: 'text-cyan-400', iconBg: 'bg-cyan-500/20' },
  emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', iconBg: 'bg-emerald-500/20' },
  purple: { bg: 'bg-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400', iconBg: 'bg-purple-500/20' },
  orange: { bg: 'bg-orange-500/5', border: 'border-orange-500/20', text: 'text-orange-400', iconBg: 'bg-orange-500/20' },
  slate: { bg: 'bg-slate-500/5', border: 'border-slate-500/20', text: 'text-slate-400', iconBg: 'bg-slate-500/20' },
};

// ============================================================================
// Theme Section Component
// ============================================================================

function ThemeSection({
  theme,
  findings,
  onConvert,
  onSelectFinding,
}: {
  theme: Theme;
  findings: DiagnosticDetailFinding[];
  onConvert: (finding: DiagnosticDetailFinding) => Promise<void>;
  onSelectFinding: (finding: DiagnosticDetailFinding) => void;
}) {
  const Icon = iconMap[theme.icon] || Lightbulb;
  const colors = colorClasses[theme.color] || colorClasses.slate;

  // Count high priority
  const highPriorityCount = findings.filter(
    f => f.severity === 'critical' || f.severity === 'high'
  ).length;

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Theme Header */}
      <div className="px-5 py-4 border-b border-slate-800/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${colors.text}`} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{theme.name}</h3>
              <p className="text-xs text-slate-500">{theme.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {highPriorityCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
                {highPriorityCount} urgent
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-700 text-slate-300">
              {findings.length} finding{findings.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Findings Grid */}
      <div className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ThemeView({ findings, onConvert, onSelectFinding }: ThemeViewProps) {
  // Cluster findings by theme
  const themedFindings = useMemo(() => getNonEmptyThemes(findings), [findings]);

  if (findings.length === 0) {
    return (
      <div className="text-center py-12">
        <Lightbulb className="w-12 h-12 mx-auto text-slate-600 mb-4" />
        <p className="text-slate-400">No findings to display.</p>
        <p className="text-sm text-slate-500 mt-1">Run diagnostics to discover issues and opportunities.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {themedFindings.map(({ theme, findings: themeFindings }) => (
        <ThemeSection
          key={theme.id}
          theme={theme}
          findings={themeFindings}
          onConvert={onConvert}
          onSelectFinding={onSelectFinding}
        />
      ))}
    </div>
  );
}

export default ThemeView;
