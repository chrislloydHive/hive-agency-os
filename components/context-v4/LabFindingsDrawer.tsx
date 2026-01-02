'use client';

// components/context-v4/LabFindingsDrawer.tsx
// Lab Findings Viewer Drawer
//
// Opens as a right-side drawer showing findings from a specific lab.
// Allows users to view structured findings and promote them to proposed facts.

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Check,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Shield,
  Swords,
  Globe,
  Beaker,
  RefreshCw,
  TrendingDown,
  ShieldAlert,
  Star,
  Info,
  Users,
} from 'lucide-react';
import type {
  LabFindingsResponse,
  LabFinding,
  FindingsGroup,
  LabKey,
  TargetFieldRecommendation,
} from '@/lib/types/labSummary';
import type { LabQualityScore, QualityWarning } from '@/lib/types/labQualityScore';
import { LAB_DISPLAY_NAMES, FINDING_CATEGORY_LABELS, FINDING_IMPACT_LABELS } from '@/lib/types/labSummary';

interface LabFindingsDrawerProps {
  companyId: string;
  labKey: LabKey | null;
  onClose: () => void;
  onPromoted?: () => void;
}

// Impact badge colors
function getImpactStyle(impact: LabFinding['impact']) {
  switch (impact) {
    case 'high':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
    case 'medium':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
    case 'low':
      return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' };
  }
}

// Promotion status badge
function PromotionBadge({ status }: { status: LabFinding['promotionStatus'] }) {
  if (status === 'not_promoted') return null;

  const styles = {
    promoted_pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Pending Review' },
    promoted_confirmed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Confirmed' },
    promoted_rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
  };

  const style = styles[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${style.bg} ${style.text} text-xs`}>
      <Check className="w-3 h-3" />
      {style.label}
    </span>
  );
}

// Single finding row
function FindingRow({
  finding,
  onPromote,
  promoting,
}: {
  finding: LabFinding;
  onPromote: (finding: LabFinding) => void;
  promoting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showMappingPicker, setShowMappingPicker] = useState(false);
  const impactStyle = getImpactStyle(finding.impact);
  const canPromote = finding.promotionStatus === 'not_promoted';

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 bg-slate-900/30">
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-0.5 text-slate-400 hover:text-white"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs ${impactStyle.bg} ${impactStyle.text}`}>
              {FINDING_IMPACT_LABELS[finding.impact]}
            </span>
            <span className="text-xs text-slate-500">
              {FINDING_CATEGORY_LABELS[finding.category]}
            </span>
            <PromotionBadge status={finding.promotionStatus} />
          </div>
          <p className="text-sm text-white mt-1 line-clamp-2">{finding.title}</p>
        </div>

        {canPromote && (
          <button
            onClick={() => setShowMappingPicker(true)}
            disabled={promoting}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            <ArrowRight className="w-4 h-4" />
            Promote
          </button>
        )}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-3 pt-0 border-t border-slate-800">
          <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">
            {finding.description}
          </p>

          {/* Evidence */}
          {finding.evidence.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-1">Evidence:</p>
              <div className="flex flex-wrap gap-2">
                {finding.evidence.map((ev, idx) => (
                  <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 rounded text-xs">
                    {ev.type === 'url' && ev.url && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {ev.label || new URL(ev.url).hostname}
                      </a>
                    )}
                    {ev.type === 'quote' && (
                      <span className="text-slate-400">"{ev.text?.slice(0, 50)}..."</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence */}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span>Confidence: {Math.round(finding.confidence * 100)}%</span>
            <span>|</span>
            <span>Hash: {finding.canonicalHash.slice(0, 8)}</span>
          </div>
        </div>
      )}

      {/* Mapping Picker Modal */}
      {showMappingPicker && (
        <MappingPicker
          finding={finding}
          onSelect={(fieldKey) => {
            setShowMappingPicker(false);
            onPromote({ ...finding, promotedToField: fieldKey });
          }}
          onClose={() => setShowMappingPicker(false)}
        />
      )}
    </div>
  );
}

// Field mapping picker
function MappingPicker({
  finding,
  onSelect,
  onClose,
}: {
  finding: LabFinding;
  onSelect: (fieldKey: string) => void;
  onClose: () => void;
}) {
  const [selectedField, setSelectedField] = useState<string | null>(
    finding.recommendedTargetFields[0]?.fieldKey || null
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-medium text-white">Promote to Fact</h3>
          <p className="text-sm text-slate-400 mt-1">
            Select which field this finding should map to
          </p>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          <div className="space-y-2">
            {finding.recommendedTargetFields.map((rec) => (
              <button
                key={rec.fieldKey}
                onClick={() => setSelectedField(rec.fieldKey)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedField === rec.fieldKey
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{rec.fieldKey}</span>
                  <span className="text-xs text-slate-500">{rec.matchScore}% match</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{rec.reason}</p>
                {(rec.hasConfirmedValue || rec.hasProposedValue) && (
                  <div className="flex gap-2 mt-2">
                    {rec.hasConfirmedValue && (
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        Has confirmed value
                      </span>
                    )}
                    {rec.hasProposedValue && (
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        Has proposed value
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedField && onSelect(selectedField)}
            disabled={!selectedField}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            Promote to Fact
          </button>
        </div>
      </div>
    </div>
  );
}

// Findings group
function FindingsGroupSection({
  group,
  onPromote,
  promoting,
}: {
  group: FindingsGroup;
  onPromote: (finding: LabFinding) => void;
  promoting: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="font-medium text-white">{group.label}</span>
          <span className="text-sm text-slate-400">({group.findings.length})</span>
        </div>
        {group.highImpactCount > 0 && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
            {group.highImpactCount} high impact
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 pl-4">
          {group.findings.map((finding) => (
            <FindingRow
              key={finding.findingId}
              finding={finding}
              onPromote={onPromote}
              promoting={promoting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Lab icons
const LAB_ICONS: Record<LabKey, React.ReactNode> = {
  websiteLab: <Globe className="w-6 h-6" />,
  competitionLab: <Swords className="w-6 h-6" />,
  brandLab: <Sparkles className="w-6 h-6" />,
  gapPlan: <Beaker className="w-6 h-6" />,
  audienceLab: <Users className="w-6 h-6" />,
};

// Quality score display helpers
function getQualityBandStyle(band: string) {
  switch (band) {
    case 'Excellent': return { bg: 'bg-green-500/20', text: 'text-green-400', icon: Star };
    case 'Good': return { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Check };
    case 'Weak': return { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: AlertTriangle };
    case 'Poor': return { bg: 'bg-red-500/20', text: 'text-red-400', icon: ShieldAlert };
    default: return { bg: 'bg-slate-500/20', text: 'text-slate-400', icon: Info };
  }
}

function QualityScoreHeader({ quality }: { quality: LabQualityScore }) {
  const style = getQualityBandStyle(quality.qualityBand);
  const Icon = style.icon;

  return (
    <div className="mb-4">
      {/* Score Display */}
      <div className={`flex items-center justify-between p-3 rounded-lg border ${style.bg} border-${quality.qualityBand === 'Poor' ? 'red' : quality.qualityBand === 'Weak' ? 'amber' : quality.qualityBand === 'Good' ? 'blue' : 'green'}-500/30`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${style.text}`} />
          <span className={`font-medium ${style.text}`}>
            Lab Quality: {quality.score}
          </span>
          <span className={`text-sm ${style.text} opacity-70`}>
            ({quality.qualityBand})
          </span>
        </div>
        {quality.regression?.isRegression && (
          <div className="flex items-center gap-1 text-red-400">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm">{quality.regression.pointDifference} pts since last run</span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {quality.warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {quality.warnings.map((warning, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                warning.severity === 'error'
                  ? 'bg-red-500/10 text-red-400'
                  : warning.severity === 'warning'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-slate-500/10 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LabFindingsDrawer({
  companyId,
  labKey,
  onClose,
  onPromoted,
}: LabFindingsDrawerProps) {
  const [data, setData] = useState<LabFindingsResponse | null>(null);
  const [quality, setQuality] = useState<LabQualityScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promotedIds, setPromotedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!labKey) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch findings and quality score in parallel
      const [findingsRes, qualityRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/labs/${labKey}/findings`, { cache: 'no-store' }),
        fetch(`/api/os/companies/${companyId}/labs/quality`, { cache: 'no-store' }),
      ]);

      const findingsJson = await findingsRes.json();
      const qualityJson = await qualityRes.json();

      if (!findingsJson.ok) {
        throw new Error(findingsJson.error || 'Failed to load findings');
      }

      setData(findingsJson);

      // Extract quality score for this lab
      if (qualityJson.ok && qualityJson.current?.[labKey]) {
        setQuality(qualityJson.current[labKey]);
      } else {
        setQuality(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId, labKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePromote = async (finding: LabFinding) => {
    if (!finding.promotedToField || !labKey) return;

    try {
      setPromoting(true);
      const response = await fetch(
        `/api/os/companies/${companyId}/context/v4/promote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            labKey,
            findingId: finding.findingId,
            targetFieldKey: finding.promotedToField,
            summary: finding.title + ': ' + finding.description.slice(0, 200),
            detailedText: finding.description,
            evidenceRefs: finding.evidence
              .filter(e => e.type === 'url' && e.url)
              .map(e => e.url),
            confidence: finding.confidence,
          }),
        }
      );

      const json = await response.json();

      if (!json.ok) {
        throw new Error(json.error || 'Failed to promote finding');
      }

      // Mark as promoted
      setPromotedIds(prev => new Set([...prev, finding.findingId]));

      // Refresh data
      await fetchData();

      // Notify parent
      onPromoted?.();
    } catch (err) {
      console.error('Failed to promote finding:', err);
      alert(err instanceof Error ? err.message : 'Failed to promote finding');
    } finally {
      setPromoting(false);
    }
  };

  if (!labKey) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-purple-400">{LAB_ICONS[labKey]}</span>
            <div>
              <h2 className="text-lg font-medium text-white">
                {LAB_DISPLAY_NAMES[labKey]} Findings
              </h2>
              {data && (
                <p className="text-sm text-slate-400">
                  {data.totalFindings} findings
                  {data.stats.promoted > 0 && ` | ${data.stats.promoted} promoted`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Quality Score Header */}
              {quality && <QualityScoreHeader quality={quality} />}

              {/* Stats Bar */}
              <div className="flex gap-4 mb-6 p-4 bg-slate-900/50 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-red-400">{data.stats.byImpact.high}</p>
                  <p className="text-xs text-slate-400">High Impact</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-amber-400">{data.stats.byImpact.medium}</p>
                  <p className="text-xs text-slate-400">Medium</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-slate-400">{data.stats.byImpact.low}</p>
                  <p className="text-xs text-slate-400">Low</p>
                </div>
                <div className="border-l border-slate-700 pl-4 text-center">
                  <p className="text-2xl font-semibold text-emerald-400">{data.stats.promoted}</p>
                  <p className="text-xs text-slate-400">Promoted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-purple-400">{data.stats.notPromoted}</p>
                  <p className="text-xs text-slate-400">Available</p>
                </div>
              </div>

              {/* Findings Groups */}
              {data.groups.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Beaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No findings extracted from this lab run</p>
                </div>
              ) : (
                data.groups.map((group) => (
                  <FindingsGroupSection
                    key={group.category}
                    group={group}
                    onPromote={handlePromote}
                    promoting={promoting}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
