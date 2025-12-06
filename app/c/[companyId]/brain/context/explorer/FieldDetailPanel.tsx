'use client';

// app/c/[companyId]/brain/context/explorer/FieldDetailPanel.tsx
// Main detail panel for selected field showing:
// - Field Overview Card
// - Value & Provenance Panel
// - History & Diff Timeline
// - Usage Panel (Labs, GAP, Insights, Work)

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  ExternalLink,
  Clock,
  User,
  Sparkles,
  Bot,
  Shield,
  RefreshCw,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  History,
  Zap,
  FileText,
  Target,
  Layers,
  ArrowRight,
  Link2,
} from 'lucide-react';
import type { GraphFieldUi, ContextDomainId } from '@/lib/contextGraph/uiHelpers';
import { CONTEXT_DOMAIN_META } from '@/lib/contextGraph/uiHelpers';
import { FIELD_WRITERS, FIELD_CONSUMERS, getWritersForField, getConsumersForField } from '@/lib/contextGraph/wiring';
import type { ExplorerInsight, ExplorerSnapshot } from './ContextExplorerClient';

// ============================================================================
// Types
// ============================================================================

interface FieldDetailPanelProps {
  field: GraphFieldUi;
  companyId: string;
  needsRefresh: boolean;
  insights: ExplorerInsight[];
  snapshots: ExplorerSnapshot[];
}

type TabId = 'value' | 'history' | 'usage';

// ============================================================================
// Domain Colors
// ============================================================================

const DOMAIN_COLORS: Record<string, string> = {
  identity: '#f59e0b',
  brand: '#8b5cf6',
  audience: '#ec4899',
  productOffer: '#10b981',
  competitive: '#ef4444',
  website: '#3b82f6',
  content: '#6366f1',
  seo: '#14b8a6',
  performanceMedia: '#f97316',
  creative: '#a855f7',
  objectives: '#06b6d4',
  ops: '#64748b',
  digitalInfra: '#475569',
  budgetOps: '#84cc16',
  historical: '#78716c',
  operationalConstraints: '#94a3b8',
  storeRisk: '#fbbf24',
  historyRefs: '#9ca3af',
};

// ============================================================================
// Source Config
// ============================================================================

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  manual: { label: 'Human', icon: User, color: 'text-emerald-400' },
  user: { label: 'Human', icon: User, color: 'text-emerald-400' },
  fcb: { label: 'FCB', icon: Sparkles, color: 'text-violet-400' },
  gap_ia: { label: 'GAP-IA', icon: Zap, color: 'text-blue-400' },
  gap_full: { label: 'GAP Full', icon: Zap, color: 'text-blue-400' },
  gap_heavy: { label: 'GAP Heavy', icon: Zap, color: 'text-blue-400' },
  brand_lab: { label: 'Brand Lab', icon: Layers, color: 'text-purple-400' },
  audience_lab: { label: 'Audience Lab', icon: Layers, color: 'text-pink-400' },
  creative_lab: { label: 'Creative Lab', icon: Layers, color: 'text-violet-400' },
  website_lab: { label: 'Website Lab', icon: Layers, color: 'text-blue-400' },
  content_lab: { label: 'Content Lab', icon: Layers, color: 'text-indigo-400' },
  seo_lab: { label: 'SEO Lab', icon: Layers, color: 'text-teal-400' },
  media_lab: { label: 'Media Lab', icon: Layers, color: 'text-orange-400' },
  setup_wizard: { label: 'Setup', icon: Target, color: 'text-amber-400' },
  inferred: { label: 'AI Inferred', icon: Bot, color: 'text-slate-400' },
};

// ============================================================================
// Criticality Helper
// ============================================================================

function getFieldCriticality(path: string): 'critical' | 'important' | 'optional' {
  const criticalPaths = [
    'identity.businessName',
    'identity.industry',
    'brand.positioning',
    'audience.primaryAudience',
    'objectives.primaryObjective',
  ];
  const importantPaths = [
    'brand.valueProps',
    'brand.differentiators',
    'audience.coreSegments',
    'audience.painPoints',
    'competitive.primaryCompetitors',
  ];

  if (criticalPaths.some(p => path.startsWith(p))) return 'critical';
  if (importantPaths.some(p => path.startsWith(p))) return 'important';
  return 'optional';
}

// ============================================================================
// Field Overview Card
// ============================================================================

function FieldOverviewCard({
  field,
  companyId,
  needsRefresh,
}: {
  field: GraphFieldUi;
  companyId: string;
  needsRefresh: boolean;
}) {
  const domainMeta = CONTEXT_DOMAIN_META[field.domain as ContextDomainId];
  const domainColor = DOMAIN_COLORS[field.domain] || '#64748b';
  const criticality = getFieldCriticality(field.path);
  const hasValue = field.value !== null && field.value !== '';

  // Calculate completeness percentage
  const completenessPercent = hasValue ? 100 : 0;

  // Get freshness info
  const freshnessLabel = useMemo(() => {
    if (!field.freshness) return 'Unknown';
    const days = field.freshness.ageDays;
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }, [field.freshness]);

  // Get confidence level
  const confidence = useMemo(() => {
    if (!field.provenance || field.provenance.length === 0) return 'unknown';
    const avgConfidence = field.provenance.reduce((sum, p) => sum + (p.confidence || 0), 0) / field.provenance.length;
    if (avgConfidence >= 0.8) return 'high';
    if (avgConfidence >= 0.5) return 'medium';
    return 'low';
  }, [field.provenance]);

  // Get sources summary
  const sourcesSummary = useMemo(() => {
    if (!field.provenance || field.provenance.length === 0) return 'No source';
    const sources = field.provenance.map(p => {
      const config = SOURCE_CONFIG[p.source];
      return config?.label || p.source;
    });
    return [...new Set(sources)].join(' + ');
  }, [field.provenance]);

  return (
    <div
      className="p-5 border-b border-slate-800"
      style={{ background: `linear-gradient(135deg, ${domainColor}10 0%, transparent 100%)` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: `${domainColor}20`, color: domainColor }}
            >
              {domainMeta?.label || field.domain}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              criticality === 'critical' ? 'bg-red-500/20 text-red-400' :
              criticality === 'important' ? 'bg-amber-500/20 text-amber-400' :
              'bg-slate-500/20 text-slate-400'
            }`}>
              {criticality === 'critical' ? 'Critical' :
               criticality === 'important' ? 'Important' : 'Nice-to-have'}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-1">
            {field.label}
          </h2>
          <p className="text-sm text-slate-500 font-mono">
            {field.path}
          </p>
        </div>

        <Link
          href={`/c/${companyId}/brain/context?section=${field.domain}`}
          className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
          Edit in Context
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        {/* Completeness */}
        <div className="p-3 bg-slate-800/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">Completeness</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  completenessPercent >= 100 ? 'bg-emerald-500' :
                  completenessPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
            <span className={`text-sm font-bold ${
              completenessPercent >= 100 ? 'text-emerald-400' :
              completenessPercent >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {completenessPercent}%
            </span>
          </div>
        </div>

        {/* Freshness */}
        <div className="p-3 bg-slate-800/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">Freshness</span>
          </div>
          <div className="flex items-center gap-2">
            {needsRefresh && <RefreshCw className="w-4 h-4 text-orange-400" />}
            <span className={`text-sm font-medium ${
              needsRefresh ? 'text-orange-400' : 'text-slate-300'
            }`}>
              {freshnessLabel}
            </span>
          </div>
        </div>

        {/* Confidence */}
        <div className="p-3 bg-slate-800/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">Confidence</span>
          </div>
          <span className={`text-sm font-medium capitalize ${
            confidence === 'high' ? 'text-emerald-400' :
            confidence === 'medium' ? 'text-amber-400' :
            confidence === 'low' ? 'text-red-400' : 'text-slate-400'
          }`}>
            {confidence}
          </span>
        </div>

        {/* Sources */}
        <div className="p-3 bg-slate-800/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">Sources</span>
          </div>
          <span className="text-sm font-medium text-slate-300 truncate block">
            {sourcesSummary}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Value & Provenance Panel
// ============================================================================

function ValueProvenancePanel({
  field,
  companyId,
}: {
  field: GraphFieldUi;
  companyId: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (field.value) {
      navigator.clipboard.writeText(field.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [field.value]);

  // Format value for display
  const formattedValue = useMemo(() => {
    if (!field.rawValue) return null;

    if (Array.isArray(field.rawValue)) {
      return (
        <ul className="space-y-1">
          {field.rawValue.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
              <span className="text-sm text-slate-300">
                {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
              </span>
            </li>
          ))}
        </ul>
      );
    }

    if (typeof field.rawValue === 'object') {
      return (
        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-800/50 p-3 rounded-lg overflow-x-auto">
          {JSON.stringify(field.rawValue, null, 2)}
        </pre>
      );
    }

    return (
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
        {field.value}
      </p>
    );
  }, [field.rawValue, field.value]);

  return (
    <div className="p-5 space-y-6">
      {/* Current Value */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Current Value
          </h3>
          {field.value && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {field.value ? (
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700/50">
            {formattedValue}
          </div>
        ) : (
          <div className="p-4 bg-slate-800/20 rounded-lg text-center">
            <p className="text-sm text-slate-500 italic">No value set</p>
            <Link
              href={`/c/${companyId}/brain/context?section=${field.domain}`}
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-amber-400 hover:text-amber-300"
            >
              <ExternalLink className="w-3 h-3" />
              Add value in Context
            </Link>
          </div>
        )}
      </div>

      {/* Provenance List */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Provenance History
        </h3>

        {field.provenance && field.provenance.length > 0 ? (
          <div className="space-y-2">
            {field.provenance.map((prov, i) => {
              const config = SOURCE_CONFIG[prov.source] || {
                label: prov.source,
                icon: Bot,
                color: 'text-slate-400',
              };
              const Icon = config.icon;

              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30"
                >
                  <div className={`p-1.5 rounded-lg bg-slate-800 ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-200">
                        {config.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        prov.confidence >= 0.8 ? 'bg-emerald-500/20 text-emerald-400' :
                        prov.confidence >= 0.5 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {Math.round(prov.confidence * 100)}% conf
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>
                        {new Date(prov.updatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {prov.notes && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="truncate">{prov.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-slate-800/20 rounded-lg text-center">
            <p className="text-sm text-slate-500 italic">No provenance data</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// History Panel
// ============================================================================

function HistoryPanel({
  field,
  snapshots,
}: {
  field: GraphFieldUi;
  snapshots: ExplorerSnapshot[];
}) {
  // Note: Full history implementation would require fetching snapshot diffs
  // For now, show available snapshots with placeholder

  return (
    <div className="p-5">
      <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
        Version History
      </h3>

      {snapshots.length > 0 ? (
        <div className="space-y-2">
          {snapshots.slice(0, 10).map((snapshot, i) => (
            <div
              key={snapshot.id}
              className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                <History className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-200">
                    {snapshot.label}
                  </span>
                  {i === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      Latest
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    {new Date(snapshot.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {snapshot.reason && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="truncate">{snapshot.reason}</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-slate-800/20 rounded-lg text-center">
          <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No history available</p>
          <p className="text-xs text-slate-600 mt-1">
            Snapshots are created when context changes
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Usage Panel
// ============================================================================

function UsagePanel({
  field,
  insights,
  companyId,
}: {
  field: GraphFieldUi;
  insights: ExplorerInsight[];
  companyId: string;
}) {
  const writers = getWritersForField(field.path);
  const consumers = getConsumersForField(field.path);

  // Module configs for display
  const moduleConfig: Record<string, { type: string; color: string; link?: (cid: string) => string }> = {
    Setup: { type: 'Setup', color: 'text-amber-400' },
    GAP: { type: 'GAP', color: 'text-blue-400', link: (cid) => `/c/${cid}/gap` },
    GAPHeavy: { type: 'GAP', color: 'text-blue-400', link: (cid) => `/c/${cid}/gap` },
    FCB: { type: 'FCB', color: 'text-violet-400' },
    BrandLab: { type: 'Lab', color: 'text-purple-400', link: (cid) => `/c/${cid}/diagnostics/brand` },
    AudienceLab: { type: 'Lab', color: 'text-pink-400', link: (cid) => `/c/${cid}/diagnostics/audience` },
    CreativeLab: { type: 'Lab', color: 'text-violet-400', link: (cid) => `/c/${cid}/labs/creative` },
    WebsiteLab: { type: 'Lab', color: 'text-blue-400' },
    ContentLab: { type: 'Lab', color: 'text-indigo-400' },
    SEOLab: { type: 'Lab', color: 'text-teal-400' },
    MediaLab: { type: 'Lab', color: 'text-orange-400' },
    CompetitorLab: { type: 'Lab', color: 'text-red-400', link: (cid) => `/c/${cid}/labs/competitor` },
    DemandLab: { type: 'Lab', color: 'text-green-400' },
    OpsLab: { type: 'Lab', color: 'text-slate-400' },
    StrategicPlan: { type: 'Plan', color: 'text-cyan-400' },
    QBR: { type: 'QBR', color: 'text-blue-400', link: (cid) => `/c/${cid}/qbr` },
    Blueprint: { type: 'Blueprint', color: 'text-emerald-400' },
    Brain: { type: 'Brain', color: 'text-amber-400', link: (cid) => `/c/${cid}/brain` },
    Work: { type: 'Work', color: 'text-violet-400', link: (cid) => `/c/${cid}/work` },
    InsightsEngine: { type: 'Insights', color: 'text-amber-400', link: (cid) => `/c/${cid}/brain/insights` },
    Analytics: { type: 'Analytics', color: 'text-green-400' },
    Manual: { type: 'Manual', color: 'text-slate-400' },
    ICPExtractor: { type: 'Extractor', color: 'text-cyan-400' },
  };

  return (
    <div className="p-5 space-y-6">
      {/* Writers */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Writers (sources that update this field)
        </h3>

        {writers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {writers.map(writer => {
              const config = moduleConfig[writer] || { type: 'Module', color: 'text-slate-400' };
              const link = config.link?.(companyId);

              const content = (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm ${config.color}`}>
                  <Zap className="w-3.5 h-3.5" />
                  {writer}
                </span>
              );

              return link ? (
                <Link key={writer} href={link} className="hover:opacity-80 transition-opacity">
                  {content}
                </Link>
              ) : (
                <span key={writer}>{content}</span>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No registered writers</p>
        )}
      </div>

      {/* Consumers */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Consumers (modules that read this field)
        </h3>

        {consumers.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {consumers.map(consumer => {
              const config = moduleConfig[consumer] || { type: 'Module', color: 'text-slate-400' };
              const link = config.link?.(companyId);

              const content = (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm ${config.color}`}>
                  <Link2 className="w-3.5 h-3.5" />
                  {consumer}
                </span>
              );

              return link ? (
                <Link key={consumer} href={link} className="hover:opacity-80 transition-opacity">
                  {content}
                </Link>
              ) : (
                <span key={consumer}>{content}</span>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No registered consumers</p>
        )}
      </div>

      {/* Related Insights */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
          Related Insights
        </h3>

        {insights.length > 0 ? (
          <div className="space-y-2">
            {insights.map(insight => (
              <Link
                key={insight.id}
                href={`/c/${companyId}/brain/insights?insightId=${insight.id}`}
                className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30 hover:border-amber-500/30 transition-colors group"
              >
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-200 group-hover:text-amber-200 transition-colors">
                    {insight.title}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 capitalize">
                      {insight.category}
                    </span>
                    {insight.severity && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        insight.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        insight.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        insight.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {insight.severity}
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-slate-800/20 rounded-lg text-center">
            <Lightbulb className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No insights linked to this field</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FieldDetailPanel({
  field,
  companyId,
  needsRefresh,
  insights,
  snapshots,
}: FieldDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('value');

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'value', label: 'Value & Provenance', icon: FileText },
    { id: 'history', label: 'History', icon: History },
    { id: 'usage', label: 'Usage', icon: Link2 },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Field Overview Card */}
      <FieldOverviewCard
        field={field}
        companyId={companyId}
        needsRefresh={needsRefresh}
      />

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'usage' && insights.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                  {insights.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'value' && (
          <ValueProvenancePanel field={field} companyId={companyId} />
        )}
        {activeTab === 'history' && (
          <HistoryPanel field={field} snapshots={snapshots} />
        )}
        {activeTab === 'usage' && (
          <UsagePanel field={field} insights={insights} companyId={companyId} />
        )}
      </div>
    </div>
  );
}
