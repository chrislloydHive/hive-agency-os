'use client';

// app/c/[companyId]/qbr/strategic-plan/StrategicPlanClient.tsx
// Strategic Plan Client Component
//
// Auto-populated from Context Graph with gap messaging for missing fields.
// 3-section layout:
// A. North Star & Objectives
// B. Core Strategies (collapsible modules)
// C. Quarterly Adjustments & Focus

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { StrategyFieldWithMeta, RecommendedDiagnostic } from '@/lib/contextGraph/domain-writers/strategyWriter';
import {
  ChevronDown,
  ChevronRight,
  Save,
  Camera,
  Clock,
  AlertCircle,
  Sparkles,
  Target,
  Users,
  User,
  Megaphone,
  Search,
  BarChart3,
  Globe,
  Package,
  Building,
  ArrowLeft,
  Info,
  AlertTriangle,
  Lock,
  RotateCcw,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Props {
  companyId: string;
  companyName: string;
  strategyFields: StrategyFieldWithMeta[];
  isSnapshotView: boolean;
  snapshotId?: string;
  snapshotLabel?: string;
  snapshotDate?: string;
  latestQbrSnapshotId?: string;
  latestQbrSnapshotLabel?: string;
  latestQbrSnapshotDate?: string;
  hasGraph: boolean;
}

interface StrategyModule {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  domains: string[];
  color: string;
}

// ============================================================================
// Strategy Module Configuration
// ============================================================================

const STRATEGY_MODULES: StrategyModule[] = [
  {
    id: 'brand',
    label: 'Brand Strategy',
    description: 'Positioning, value props, and competitive differentiation',
    icon: <Megaphone className="w-4 h-4" />,
    domains: ['brand'],
    color: 'purple',
  },
  {
    id: 'audience',
    label: 'Audience Strategy',
    description: 'Target segments, personas, and buyer journey',
    icon: <Users className="w-4 h-4" />,
    domains: ['audience'],
    color: 'blue',
  },
  {
    id: 'content',
    label: 'Content Strategy',
    description: 'Content pillars, formats, and distribution',
    icon: <Sparkles className="w-4 h-4" />,
    domains: ['content'],
    color: 'pink',
  },
  {
    id: 'seo',
    label: 'SEO Strategy',
    description: 'Keywords, technical SEO, and link building',
    icon: <Search className="w-4 h-4" />,
    domains: ['seo'],
    color: 'green',
  },
  {
    id: 'media',
    label: 'Media Strategy',
    description: 'Channel mix, targeting, and bid strategies',
    icon: <BarChart3 className="w-4 h-4" />,
    domains: ['performanceMedia'],
    color: 'amber',
  },
  {
    id: 'website',
    label: 'Website Strategy',
    description: 'Conversion goals, UX, and tech stack',
    icon: <Globe className="w-4 h-4" />,
    domains: ['website'],
    color: 'cyan',
  },
  {
    id: 'product',
    label: 'Product & Offer Strategy',
    description: 'Products, pricing, and promotions',
    icon: <Package className="w-4 h-4" />,
    domains: ['productOffer'],
    color: 'orange',
  },
  {
    id: 'ops',
    label: 'Operations & Store Strategy',
    description: 'Operational constraints and store performance',
    icon: <Building className="w-4 h-4" />,
    domains: ['operationalConstraints', 'storeRisk'],
    color: 'slate',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return '';
  }
}

function formatFieldName(path: string): string {
  const field = path.split('.').pop() || path;
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function getFieldValue(fields: StrategyFieldWithMeta[], path: string): unknown {
  const field = fields.find((f) => f.path === path);
  return field?.value ?? null;
}

function getField(fields: StrategyFieldWithMeta[], path: string): StrategyFieldWithMeta | undefined {
  return fields.find((f) => f.path === path);
}

function getFieldsForDomains(fields: StrategyFieldWithMeta[], domains: string[]): StrategyFieldWithMeta[] {
  return fields.filter((f) => domains.includes(f.domain));
}

// ============================================================================
// Gap Message Component
// ============================================================================

function GapMessage({
  recommendedDiagnostics,
  companyId,
}: {
  recommendedDiagnostics: RecommendedDiagnostic[];
  companyId: string;
}) {
  if (recommendedDiagnostics.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic">
        Not enough background diagnostics to auto-complete this.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="italic">Not enough background diagnostics to auto-complete this.</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {recommendedDiagnostics.map((diag) => (
          <Link
            key={diag.id}
            href={diag.toolId ? `/c/${companyId}/diagnostics?tool=${diag.toolId}` : `/c/${companyId}/diagnostics`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            {diag.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Provenance Badge Component
// ============================================================================

function ProvenanceBadge({
  field,
  onRevert,
  disabled,
}: {
  field: StrategyFieldWithMeta;
  onRevert?: (path: string) => void;
  disabled?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  if (!field.sourceName && !field.updatedAt) return null;

  const ageText = field.updatedAt ? formatTimeAgo(field.updatedAt) : null;
  const isStale = field.status === 'stale';
  const canRevert = field.isHumanOverride && field.provenanceHistory.length > 1 && !disabled;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`
          flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-[10px] transition-colors
          ${field.isHumanOverride
            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
            : isStale
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'bg-slate-800/50 text-slate-500 border border-slate-700/50'
          }
          hover:bg-slate-800
        `}
      >
        {field.isHumanOverride ? (
          <User className="w-3 h-3" />
        ) : isStale ? (
          <Clock className="w-3 h-3" />
        ) : (
          <Info className="w-3 h-3" />
        )}
        <span>
          {field.isHumanOverride && <span className="font-medium">Edited</span>}
          {!field.isHumanOverride && field.sourceName && <span>{field.sourceName}</span>}
          {ageText && !field.isHumanOverride && <> • {ageText}</>}
          {field.isHumanOverride && ageText && <> {ageText}</>}
        </span>
        {isStale && !field.isHumanOverride && (
          <span className="font-medium">(stale)</span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>

      {/* Provenance Details Dropdown */}
      {showDetails && (
        <div className="absolute z-20 mt-1 left-0 w-64 p-3 rounded-lg bg-slate-900 border border-slate-700 shadow-xl">
          <div className="space-y-2">
            {/* Human Override Notice */}
            {field.isHumanOverride && (
              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  <Lock className="w-3 h-3" />
                  Manual Edit Protected
                </div>
                <p className="text-blue-400/80">
                  This value won't be overwritten by automated sources.
                </p>
              </div>
            )}

            {/* Stale Notice */}
            {isStale && !field.isHumanOverride && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  Data May Be Stale
                </div>
                <p className="text-amber-400/80">
                  Last updated {field.ageDays?.toFixed(0)} days ago. Consider running diagnostics to refresh.
                </p>
              </div>
            )}

            {/* Current Source */}
            <div className="text-xs">
              <span className="text-slate-500">Source:</span>{' '}
              <span className="text-slate-300">{field.sourceName || 'Unknown'}</span>
            </div>

            {/* Updated At */}
            {field.updatedAt && (
              <div className="text-xs">
                <span className="text-slate-500">Updated:</span>{' '}
                <span className="text-slate-300">{formatDate(field.updatedAt)}</span>
              </div>
            )}

            {/* Confidence */}
            {field.confidence > 0 && (
              <div className="text-xs">
                <span className="text-slate-500">Confidence:</span>{' '}
                <span className="text-slate-300">{Math.round(field.confidence * 100)}%</span>
              </div>
            )}

            {/* Previous Source (for revert hint) */}
            {field.previousSourceName && (
              <div className="text-xs">
                <span className="text-slate-500">Previous:</span>{' '}
                <span className="text-slate-300">{field.previousSourceName}</span>
              </div>
            )}

            {/* Authoritative Sources */}
            {field.authoritativeSources.length > 0 && (
              <div className="pt-2 border-t border-slate-700">
                <div className="text-[10px] text-slate-500 mb-1">Authoritative sources for this field:</div>
                <div className="flex flex-wrap gap-1">
                  {field.authoritativeSources.map((src) => (
                    <span
                      key={src}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Revert Button */}
            {canRevert && onRevert && (
              <div className="pt-2 border-t border-slate-700">
                <button
                  onClick={() => {
                    onRevert(field.path);
                    setShowDetails(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Revert to {field.previousSourceName || 'previous'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Simple Provenance Hint (for less interactive contexts)
// ============================================================================

function ProvenanceHint({
  sourceName,
  ageDays,
  updatedAt,
}: {
  sourceName: string | null;
  ageDays: number | null;
  updatedAt: string | null;
}) {
  if (!sourceName && !updatedAt) return null;

  const ageText = updatedAt ? formatTimeAgo(updatedAt) : null;

  return (
    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
      <Info className="w-3 h-3" />
      <span>
        {sourceName && <>From: <span className="text-slate-400">{sourceName}</span></>}
        {sourceName && ageText && <> • </>}
        {ageText && <span className="text-slate-400">{ageText}</span>}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategicPlanClient({
  companyId,
  companyName,
  strategyFields,
  isSnapshotView,
  snapshotId,
  snapshotLabel,
  snapshotDate,
  latestQbrSnapshotId,
  latestQbrSnapshotLabel,
  latestQbrSnapshotDate,
  hasGraph,
}: Props) {
  const router = useRouter();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['brand', 'audience']));
  const [editedFields, setEditedFields] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [snapshotSuccess, setSnapshotSuccess] = useState<string | null>(null);

  // Toggle module expansion
  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }, []);

  // Handle field edit
  const handleFieldEdit = useCallback((path: string, value: unknown) => {
    setEditedFields((prev) => ({
      ...prev,
      [path]: value,
    }));
  }, []);

  // Get current value (edited or original)
  const getCurrentValue = useCallback(
    (path: string): unknown => {
      if (path in editedFields) {
        return editedFields[path];
      }
      return getFieldValue(strategyFields, path);
    },
    [editedFields, strategyFields]
  );

  // Save changes
  const handleSave = useCallback(async () => {
    if (Object.keys(editedFields).length === 0) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: editedFields }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      // Clear edited fields and refresh
      setEditedFields({});
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [companyId, editedFields, router]);

  // Create snapshot
  const handleCreateSnapshot = useCallback(async () => {
    setIsCreatingSnapshot(true);
    setSaveError(null);
    setSnapshotSuccess(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'qbr',
          label: `Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()} Strategic Plan`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create snapshot');
      }

      const result = await response.json();
      setSnapshotSuccess(`Snapshot created: ${result.label}`);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to create snapshot');
    } finally {
      setIsCreatingSnapshot(false);
    }
  }, [companyId, router]);

  // Revert a field to its previous value
  const handleRevert = useCallback(async (path: string) => {
    setSaveError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revert',
          path,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revert');
      }

      // Clear any local edits for this field
      setEditedFields((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });

      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to revert');
    }
  }, [companyId, router]);

  // Check for unsaved changes
  const hasUnsavedChanges = Object.keys(editedFields).length > 0;

  // Get key fields for North Star section
  const northStarField = getField(strategyFields, 'identity.northStar');
  const visionField = getField(strategyFields, 'identity.vision');
  const missionField = getField(strategyFields, 'identity.mission');
  const primaryObjectiveField = getField(strategyFields, 'objectives.primaryObjective');
  const successMetricsField = getField(strategyFields, 'objectives.successMetrics');

  // Calculate coverage stats
  const totalFields = strategyFields.length;
  const populatedFields = strategyFields.filter((f) => f.status === 'populated').length;
  const missingFields = strategyFields.filter((f) => f.status === 'missing').length;
  const coveragePercent = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Snapshot Banner (if viewing historical) */}
      {isSnapshotView && snapshotLabel && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                Viewing snapshot: {snapshotLabel}
              </p>
              {snapshotDate && (
                <p className="text-xs text-amber-400/70">
                  Created {formatDate(snapshotDate)}
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/c/${companyId}/qbr/strategic-plan`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Live Plan
          </Link>
        </div>
      )}

      {/* No Graph Warning */}
      {!hasGraph && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-300">
              No Context Graph found
            </p>
            <p className="text-xs text-red-400/70">
              Run diagnostics or Strategic Setup to populate the company context.
            </p>
          </div>
        </div>
      )}

      {/* Coverage Summary */}
      {hasGraph && !isSnapshotView && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-sm font-bold text-slate-200">{coveragePercent}%</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">Context Coverage</p>
                <p className="text-xs text-slate-500">
                  {populatedFields} of {totalFields} fields populated
                </p>
              </div>
            </div>
            {missingFields > 0 && (
              <div className="flex items-center gap-2 pl-4 border-l border-slate-700">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-400">
                  {missingFields} fields need diagnostics
                </span>
              </div>
            )}
          </div>
          <Link
            href={`/c/${companyId}/diagnostics`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
          >
            Run Diagnostics
          </Link>
        </div>
      )}

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-200">Strategic Plan</h2>
          <p className="text-sm text-slate-500">
            {companyName} &middot; Living strategy document
          </p>
        </div>

        {!isSnapshotView && (
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleCreateSnapshot}
              disabled={isCreatingSnapshot}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
            >
              {isCreatingSnapshot ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Update Snapshot
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {saveError}
        </div>
      )}
      {snapshotSuccess && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm text-green-300">
          {snapshotSuccess}
        </div>
      )}

      {/* Latest Snapshot Reference */}
      {latestQbrSnapshotId && !isSnapshotView && (
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 text-sm">
          <span className="text-slate-400">Last QBR snapshot: </span>
          <Link
            href={`/c/${companyId}/qbr/strategic-plan?snapshotId=${latestQbrSnapshotId}`}
            className="text-blue-400 hover:text-blue-300"
          >
            {latestQbrSnapshotLabel}
          </Link>
          {latestQbrSnapshotDate && (
            <span className="text-slate-500"> ({formatDate(latestQbrSnapshotDate)})</span>
          )}
        </div>
      )}

      {/* Section A: North Star & Objectives */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Target className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">North Star & Objectives</h3>
              <p className="text-xs text-slate-500">Vision, mission, and 12-month success outcomes</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* North Star */}
          <StrategyFieldInput
            field={northStarField}
            label="North Star Statement"
            placeholder="What is the ultimate guiding principle for this company?"
            value={getCurrentValue('identity.northStar')}
            onChange={(value) => handleFieldEdit('identity.northStar', value)}
            disabled={isSnapshotView}
            companyId={companyId}
            rows={2}
            onRevert={handleRevert}
          />

          {/* Vision & Mission */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StrategyFieldInput
              field={visionField}
              label="Vision"
              placeholder="Where does this company want to be?"
              value={getCurrentValue('identity.vision')}
              onChange={(value) => handleFieldEdit('identity.vision', value)}
              disabled={isSnapshotView}
              companyId={companyId}
              rows={3}
              onRevert={handleRevert}
            />
            <StrategyFieldInput
              field={missionField}
              label="Mission"
              placeholder="What is the company's purpose?"
              value={getCurrentValue('identity.mission')}
              onChange={(value) => handleFieldEdit('identity.mission', value)}
              disabled={isSnapshotView}
              companyId={companyId}
              rows={3}
              onRevert={handleRevert}
            />
          </div>

          {/* Primary Objective */}
          <StrategyFieldInput
            field={primaryObjectiveField}
            label="Primary Business Objective"
            placeholder="e.g., Increase MRR by 40% in 12 months"
            value={getCurrentValue('objectives.primaryObjective')}
            onChange={(value) => handleFieldEdit('objectives.primaryObjective', value)}
            disabled={isSnapshotView}
            companyId={companyId}
            isInput
            onRevert={handleRevert}
          />

          {/* Success Metrics */}
          <StrategyFieldInput
            field={successMetricsField}
            label="12-Month Success Outcomes"
            placeholder="Enter success metrics (one per line)"
            value={getCurrentValue('objectives.successMetrics')}
            onChange={(value) => handleFieldEdit('objectives.successMetrics', value)}
            disabled={isSnapshotView}
            companyId={companyId}
            isArray
            rows={4}
            onRevert={handleRevert}
          />

          {/* AI Alignment Summary Placeholder */}
          <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-medium text-purple-300 uppercase tracking-wide">
                AI Alignment Summary
              </span>
            </div>
            <p className="text-sm text-slate-400 italic">
              AI-generated alignment analysis will appear here, showing how objectives, strategies, and tactics connect.
            </p>
          </div>
        </div>
      </section>

      {/* Section B: Core Strategies */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Core Strategies
          </h3>
          <span className="text-xs text-slate-500">
            (Click to expand)
          </span>
        </div>

        {STRATEGY_MODULES.map((module) => {
          const isExpanded = expandedModules.has(module.id);
          const moduleFields = getFieldsForDomains(strategyFields, module.domains);
          const populatedCount = moduleFields.filter((f) => f.status === 'populated').length;
          const missingCount = moduleFields.filter((f) => f.status === 'missing').length;

          return (
            <div
              key={module.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden"
            >
              {/* Module Header */}
              <button
                onClick={() => toggleModule(module.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-${module.color}-500/20 flex items-center justify-center text-${module.color}-400`}>
                    {module.icon}
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-medium text-slate-200">{module.label}</h4>
                    <p className="text-xs text-slate-500">{module.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      {populatedCount}/{moduleFields.length} fields
                    </span>
                    {missingCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        {missingCount} missing
                      </span>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Module Content */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    {moduleFields.map((field) => (
                      <StrategyFieldInput
                        key={field.path}
                        field={field}
                        label={formatFieldName(field.path)}
                        value={getCurrentValue(field.path)}
                        onChange={(value) => handleFieldEdit(field.path, value)}
                        disabled={isSnapshotView}
                        companyId={companyId}
                        isArray={Array.isArray(field.value)}
                        onRevert={handleRevert}
                      />
                    ))}
                    {moduleFields.length === 0 && (
                      <div className="col-span-2 py-8 text-center text-slate-500 text-sm">
                        No fields defined for this strategy module yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Section C: Quarterly Adjustments */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-cyan-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Quarterly Adjustments & Focus</h3>
              <p className="text-xs text-slate-500">What changed and what to prioritize this quarter</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* AI Summary Placeholder */}
          <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-medium text-cyan-300 uppercase tracking-wide">
                AI-Generated Quarterly Summary
              </span>
            </div>
            <p className="text-sm text-slate-400 italic">
              AI will analyze changes from the previous snapshot and summarize key strategic shifts.
            </p>
          </div>

          {/* Quarterly Narrative */}
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
              Quarterly Focus Narrative
            </label>
            <textarea
              disabled={isSnapshotView}
              placeholder="Describe the key focus areas and adjustments for this quarter..."
              className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 resize-none disabled:opacity-60"
              rows={4}
            />
          </div>

          {/* Link to Work */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700">
            <div>
              <p className="text-sm font-medium text-slate-300">Quarterly Initiatives</p>
              <p className="text-xs text-slate-500">View and manage work items for this quarter</p>
            </div>
            <Link
              href={`/c/${companyId}/work`}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
            >
              Go to Work
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Strategy Field Input Component
// ============================================================================

function StrategyFieldInput({
  field,
  label,
  placeholder,
  value,
  onChange,
  disabled,
  companyId,
  isArray,
  isInput,
  rows = 3,
  onRevert,
}: {
  field: StrategyFieldWithMeta | undefined;
  label?: string;
  placeholder?: string;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
  companyId: string;
  isArray?: boolean;
  isInput?: boolean;
  rows?: number;
  onRevert?: (path: string) => void;
}) {
  const displayLabel = label || (field ? formatFieldName(field.path) : 'Field');
  const status = field?.status || 'missing';
  const isMissing = status === 'missing';
  const isStale = status === 'stale';

  // For missing fields with no edits, show gap message
  const showGapMessage = isMissing && (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0));

  if (showGapMessage && field?.recommendedDiagnostics) {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
          {displayLabel}
          {isStale && (
            <span className="ml-2 text-amber-400 normal-case">(stale)</span>
          )}
        </label>
        <div className="p-4 rounded-lg bg-slate-800/30 border border-dashed border-slate-700">
          <GapMessage
            recommendedDiagnostics={field.recommendedDiagnostics}
            companyId={companyId}
          />
        </div>
      </div>
    );
  }

  // Human override indicator
  const humanOverrideIndicator = field?.isHumanOverride && (
    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400">
      <Lock className="w-2.5 h-2.5" />
      Edited
    </span>
  );

  // Handle array fields
  if (isArray) {
    const arrayValue = Array.isArray(value) ? value : [];
    return (
      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
          {displayLabel}
          {isStale && !field?.isHumanOverride && (
            <span className="ml-2 text-amber-400 normal-case">(stale)</span>
          )}
          {humanOverrideIndicator}
        </label>
        <textarea
          value={arrayValue.join('\n')}
          onChange={(e) => onChange(e.target.value.split('\n').filter(Boolean))}
          disabled={disabled}
          placeholder={placeholder || `Enter ${displayLabel.toLowerCase()} (one per line)`}
          className={`w-full px-3 py-2 rounded-lg bg-slate-800/50 border text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 resize-none disabled:opacity-60 ${
            field?.isHumanOverride
              ? 'border-blue-500/30 focus:ring-blue-500/50 focus:border-blue-500/50'
              : 'border-slate-700 focus:ring-blue-500/50 focus:border-blue-500/50'
          }`}
          rows={rows}
        />
        {field && (
          <ProvenanceBadge
            field={field}
            onRevert={onRevert}
            disabled={disabled}
          />
        )}
      </div>
    );
  }

  // Handle input fields
  if (isInput) {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
          {displayLabel}
          {isStale && !field?.isHumanOverride && (
            <span className="ml-2 text-amber-400 normal-case">(stale)</span>
          )}
          {humanOverrideIndicator}
        </label>
        <input
          type="text"
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder || `Enter ${displayLabel.toLowerCase()}`}
          className={`w-full px-4 py-3 rounded-lg bg-slate-800/50 border text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 disabled:opacity-60 ${
            field?.isHumanOverride
              ? 'border-blue-500/30 focus:ring-blue-500/50 focus:border-blue-500/50'
              : 'border-slate-700 focus:ring-amber-500/50 focus:border-amber-500/50'
          }`}
        />
        {field && (
          <ProvenanceBadge
            field={field}
            onRevert={onRevert}
            disabled={disabled}
          />
        )}
      </div>
    );
  }

  // Default textarea
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
        {displayLabel}
        {isStale && !field?.isHumanOverride && (
          <span className="ml-2 text-amber-400 normal-case">(stale)</span>
        )}
        {humanOverrideIndicator}
      </label>
      <textarea
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder || `Enter ${displayLabel.toLowerCase()}`}
        className={`w-full px-4 py-3 rounded-lg bg-slate-800/50 border text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 resize-none disabled:opacity-60 ${
          field?.isHumanOverride
            ? 'border-blue-500/30 focus:ring-blue-500/50 focus:border-blue-500/50'
            : 'border-slate-700 focus:ring-amber-500/50 focus:border-amber-500/50'
        }`}
        rows={rows}
      />
      {field && (
        <ProvenanceBadge
          field={field}
          onRevert={onRevert}
          disabled={disabled}
        />
      )}
    </div>
  );
}
