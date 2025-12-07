'use client';

// app/c/[companyId]/brain/map/NodeDrawer.tsx
// Strategic Map 2.0 Node Drawer - Full Rewrite
//
// Sections:
// 1. Header - Node name, domain, status chips, health indicators
// 2. Summary - AI summary with strengths/weaknesses
// 3. Field Details - Grouped fields with editable state
// 4. Connections - Upstream & downstream with preview cards
// 5. AI Insights - Node-level insights with generate button
// 6. Related Work - Work items linked to this node
// 7. Footer - CTA buttons (Edit in Context, Ask AI, Propose Fix, Create Work Item)

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  ChevronRight,
  ChevronDown,
  User,
  Bot,
  Sparkles,
  Clock,
  Lock,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Zap,
  MessageSquare,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Circle,
  RefreshCw,
  Edit3,
  PlusCircle,
  Wrench,
  FileText,
  Activity,
  Shield,
  AlertTriangle,
  Link2,
  History,
  Target,
  Unlock,
} from 'lucide-react';
import { useStrategicMap, type NodeInsight } from './StrategicMapContext';
import {
  DOMAIN_COLORS,
  DOMAIN_LABELS,
  type StrategicMapNode,
  getHeatmapColor,
} from '@/lib/contextGraph/strategicMap';
import type { WorkItem } from '@/lib/types/work';
import type { ClientInsight, InsightSeverity } from '@/lib/types/clientBrain';
import { INSIGHT_SEVERITY_CONFIG, INSIGHT_CATEGORY_CONFIG } from '@/lib/types/clientBrain';

// ============================================================================
// Types
// ============================================================================

interface NodeDrawerProps {
  className?: string;
}

interface FieldValue {
  path: string;
  label: string;
  value: string | number | string[] | null;
  source: 'human' | 'ai' | 'mixed';
  confidence: number;
  lastUpdated?: string;
  isLocked?: boolean;
  isEditing?: boolean;
}

interface FieldGroup {
  name: string;
  fields: FieldValue[];
}

interface ConnectedNodePreview {
  node: StrategicMapNode;
  direction: 'upstream' | 'downstream';
  edgeStrength: 'strong' | 'weak' | 'inferred';
  relevance: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatFieldLabel(path: string): string {
  const lastPart = path.split('.').pop() || path;
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function groupFieldsByDomain(fields: FieldValue[]): FieldGroup[] {
  const groups: Record<string, FieldValue[]> = {};

  for (const field of fields) {
    const parts = field.path.split('.');
    const groupName = parts.length > 1 ? formatFieldLabel(parts[0]) : 'General';
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(field);
  }

  return Object.entries(groups).map(([name, fields]) => ({ name, fields }));
}

// ============================================================================
// Section Components
// ============================================================================

function SectionHeader({
  title,
  icon: Icon,
  count,
  isCollapsible = false,
  isOpen = true,
  onToggle,
  action,
}: {
  title: string;
  icon: React.ElementType;
  count?: number;
  isCollapsible?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <button
        onClick={onToggle}
        disabled={!isCollapsible}
        className={`flex items-center gap-2 ${
          isCollapsible ? 'cursor-pointer hover:text-slate-300' : 'cursor-default'
        }`}
      >
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-slate-700 text-slate-400 rounded-full">
            {count}
          </span>
        )}
        {isCollapsible && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? '' : '-rotate-90'}`}
          />
        )}
      </button>
      {action}
    </div>
  );
}

// ============================================================================
// Status Chips
// ============================================================================

function CompletenessChip({ completeness }: { completeness: 'full' | 'partial' | 'empty' }) {
  const config = {
    full: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Complete' },
    partial: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Partial' },
    empty: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Empty' },
  }[completeness];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
      <Circle className="w-2 h-2 fill-current" />
      {config.label}
    </span>
  );
}

function ConfidenceChip({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'High' },
    medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Medium' },
    low: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Low' },
  }[confidence];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
      <Shield className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function SourceChip({ source }: { source: 'human' | 'ai' | 'mixed' }) {
  const config = {
    human: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: User, label: 'Human' },
    ai: { bg: 'bg-violet-500/15', text: 'text-violet-400', icon: Sparkles, label: 'AI' },
    mixed: { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: Bot, label: 'Mixed' },
  }[source];
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function CriticalityChip({ criticality }: { criticality: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'Critical' },
    medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Important' },
    low: { bg: 'bg-slate-500/15', text: 'text-slate-400', label: 'Optional' },
  }[criticality];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.text}`}>
      <Target className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// ============================================================================
// Score Indicator
// ============================================================================

function ScoreIndicator({
  label,
  score,
  showBar = true,
}: {
  label: string;
  score: number;
  showBar?: boolean;
}) {
  const color = score >= 70 ? 'emerald' : score >= 40 ? 'amber' : 'red';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-500 w-20">{label}</span>
      {showBar && (
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-${color}-500`}
            style={{ width: `${score}%` }}
          />
        </div>
      )}
      <span className={`text-[10px] font-bold text-${color}-400 w-8 text-right`}>
        {score}%
      </span>
    </div>
  );
}

// ============================================================================
// Conflict Badge
// ============================================================================

interface NodeConflictType {
  type: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  relatedNodeIds: string[];
}

function ConflictBadge({ conflicts }: { conflicts: NodeConflictType[] }) {
  if (conflicts.length === 0) return null;

  const highSeverity = conflicts.filter(c => c.severity === 'high').length;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded-lg">
      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
      <span className="text-[10px] text-red-400 font-medium">
        {conflicts.length} {conflicts.length === 1 ? 'conflict' : 'conflicts'}
        {highSeverity > 0 && ` (${highSeverity} critical)`}
      </span>
    </div>
  );
}

// ============================================================================
// Field Row with Edit Support
// ============================================================================

function EditableFieldRow({
  field,
  onEdit,
  onLockToggle,
}: {
  field: FieldValue;
  onEdit?: (path: string, value: string) => void;
  onLockToggle?: (path: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const SourceIcon = {
    human: User,
    ai: Sparkles,
    mixed: Bot,
  }[field.source];

  const sourceColor = {
    human: 'text-emerald-400',
    ai: 'text-violet-400',
    mixed: 'text-amber-400',
  }[field.source];

  const formatValue = (val: string | number | string[] | null) => {
    if (val === null) return <span className="text-slate-600 italic">Not set</span>;
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  };

  const handleStartEdit = () => {
    setEditValue(field.value ? String(field.value) : '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (onEdit) {
      onEdit(field.path, editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  return (
    <div className="group flex items-start justify-between gap-3 py-2.5 px-3 -mx-3 rounded-lg hover:bg-slate-800/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-slate-400 font-medium">{field.label}</span>
          <SourceIcon className={`w-3 h-3 ${sourceColor}`} />
          {field.isLocked ? (
            <button
              onClick={() => onLockToggle?.(field.path)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Unlock field"
            >
              <Lock className="w-3 h-3 text-amber-400 hover:text-amber-300" />
            </button>
          ) : (
            <button
              onClick={() => onLockToggle?.(field.path)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Lock field"
            >
              <Unlock className="w-3 h-3 text-slate-500 hover:text-slate-400" />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500/50"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="p-1 text-emerald-400 hover:text-emerald-300"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-slate-400 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-200 truncate flex-1">
              {formatValue(field.value)}
            </p>
            {!field.isLocked && (
              <button
                onClick={handleStartEdit}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-400 transition-opacity"
                title="Edit field"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {field.confidence < 0.5 && (
          <span className="text-[9px] px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded">
            Low conf.
          </span>
        )}
        {field.lastUpdated && (
          <span className="text-[10px] text-slate-600 whitespace-nowrap">
            {new Date(field.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Connection Preview Card
// ============================================================================

function ConnectionPreviewCard({
  preview,
  onClick,
}: {
  preview: ConnectedNodePreview;
  onClick: () => void;
}) {
  const { node, direction, edgeStrength, relevance } = preview;
  const ArrowIcon = direction === 'upstream' ? ArrowUpRight : ArrowDownRight;

  const strengthStyles = {
    strong: 'border-emerald-500/30 bg-emerald-500/5',
    weak: 'border-slate-600 bg-slate-800/30',
    inferred: 'border-violet-500/30 bg-violet-500/5 border-dashed',
  }[edgeStrength];

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all hover:scale-[1.02] ${strengthStyles}`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${DOMAIN_COLORS[node.domain]}20` }}
      >
        <span
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: DOMAIN_COLORS[node.domain] }}
        />
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-200 truncate">
            {node.label}
          </span>
          <ArrowIcon className="w-3 h-3 text-slate-500" />
        </div>
        <p className="text-[10px] text-slate-500 truncate mt-0.5">
          {relevance || DOMAIN_LABELS[node.domain]}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <CompletenessChip completeness={node.completeness} />
          {edgeStrength === 'inferred' && (
            <span className="text-[9px] px-1 py-0.5 bg-violet-500/20 text-violet-400 rounded">
              AI-inferred
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Insight Card
// ============================================================================

function InsightCard({ insight }: { insight: NodeInsight }) {
  const typeConfig = {
    opportunity: { icon: TrendingUp, color: 'emerald', label: 'Opportunity' },
    gap: { icon: AlertCircle, color: 'amber', label: 'Gap' },
    strength: { icon: CheckCircle, color: 'blue', label: 'Strength' },
    risk: { icon: TrendingDown, color: 'red', label: 'Risk' },
  }[insight.type];

  const priorityConfig = {
    high: { bg: 'bg-red-500/20', text: 'text-red-400' },
    medium: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    low: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  }[insight.priority];

  const Icon = typeConfig.icon;

  return (
    <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 text-${typeConfig.color}-400 mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-slate-200 truncate">
              {insight.title}
            </h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityConfig.bg} ${priorityConfig.text}`}>
              {insight.priority}
            </span>
            {insight.actionable && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                Actionable
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
            {insight.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Brain Insight Card (from ClientInsight)
// ============================================================================

function BrainInsightCard({
  insight,
  companyId,
}: {
  insight: ClientInsight;
  companyId: string;
}) {
  const severityConfig = insight.severity ? INSIGHT_SEVERITY_CONFIG[insight.severity] : null;
  const categoryConfig = INSIGHT_CATEGORY_CONFIG[insight.category];

  return (
    <Link
      href={`/c/${companyId}/brain/insights?id=${insight.id}`}
      className="block p-3 bg-slate-800/30 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-slate-200 truncate group-hover:text-amber-200 transition-colors">
              {insight.title}
            </h4>
            {severityConfig && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded bg-${severityConfig.color}-500/20 text-${severityConfig.color}-400`}>
                {severityConfig.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
            {insight.body}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[9px] px-1.5 py-0.5 rounded bg-${categoryConfig.color}-500/20 text-${categoryConfig.color}-400`}>
              {categoryConfig.label}
            </span>
            <span className="text-[10px] text-slate-600 flex items-center gap-1 group-hover:text-amber-400 transition-colors">
              View insight
              <ExternalLink className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ============================================================================
// Work Item Card
// ============================================================================

function WorkItemCard({
  workItem,
  onClick,
}: {
  workItem: WorkItem;
  onClick?: () => void;
}) {
  const statusConfig: Record<string, { bg: string; text: string }> = {
    'Backlog': { bg: 'bg-slate-500/20', text: 'text-slate-400' },
    'Planned': { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    'In Progress': { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    'Done': { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  };

  const status = statusConfig[workItem.status] || statusConfig['Backlog'];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors text-left"
    >
      <FileText className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-slate-200 truncate">
          {workItem.title}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${status.bg} ${status.text}`}>
            {workItem.status}
          </span>
          {workItem.priority && (
            <span className="text-[10px] text-slate-500">
              {workItem.priority}
            </span>
          )}
          {workItem.area && (
            <span className="text-[10px] text-slate-600">
              • {workItem.area}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// CTA Button
// ============================================================================

function CTAButton({
  label,
  icon: Icon,
  variant = 'default',
  onClick,
  href,
  disabled,
  loading,
}: {
  label: string;
  icon: React.ElementType;
  variant?: 'default' | 'primary' | 'accent' | 'danger';
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const variantStyles = {
    default: 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 border-slate-700',
    primary: 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border-amber-500/30',
    accent: 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border-violet-500/30',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',
  }[variant];

  const content = (
    <>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icon className="w-4 h-4" />
      )}
      <span className="truncate">{label}</span>
    </>
  );

  const className = `flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled || loading} className={className}>
      {content}
    </button>
  );
}

// ============================================================================
// AI Summary Section
// ============================================================================

function AISummarySection({
  summary,
  isLoading,
  onGenerate,
  node,
}: {
  summary: { summary: string; recommendations: string[] } | null;
  isLoading: boolean;
  onGenerate: () => void;
  node: StrategicMapNode;
}) {
  // Derive strengths and weaknesses from node data
  const strengths = useMemo(() => {
    const items: string[] = [];
    if (node.completeness === 'full') items.push('Fully complete data');
    if (node.confidence === 'high') items.push('High confidence scores');
    if (node.provenanceKind === 'human') items.push('Human-verified content');
    if (node.dependencyCount >= 3) items.push('Well-connected in strategy');
    return items;
  }, [node]);

  const weaknesses = useMemo(() => {
    const items: string[] = [];
    if (node.completeness === 'empty') items.push('Missing data');
    if (node.completeness === 'partial') items.push('Incomplete fields');
    if (node.confidence === 'low') items.push('Low confidence');
    if (node.conflictFlags.length > 0) items.push(`${node.conflictFlags.length} conflicts detected`);
    if (node.freshnessScore < 40) items.push('Stale information');
    return items;
  }, [node]);

  return (
    <section className="space-y-3">
      <SectionHeader title="Summary" icon={Lightbulb} />

      {isLoading ? (
        <div className="flex items-center gap-2 p-4 bg-slate-800/30 rounded-lg">
          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
          <span className="text-sm text-slate-400">Generating summary...</span>
        </div>
      ) : summary ? (
        <div className="space-y-3">
          <div className="p-3 bg-slate-800/30 rounded-lg">
            <p className="text-sm text-slate-300 leading-relaxed">{summary.summary}</p>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-2 gap-3">
            {strengths.length > 0 && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-400 uppercase">Strengths</span>
                </div>
                <ul className="space-y-1">
                  {strengths.map((s, i) => (
                    <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {weaknesses.length > 0 && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3 h-3 text-red-400" />
                  <span className="text-[10px] font-medium text-red-400 uppercase">Weaknesses</span>
                </div>
                <ul className="space-y-1">
                  {weaknesses.map((w, i) => (
                    <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {summary.recommendations.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-medium text-amber-400 uppercase">Recommendations</span>
              </div>
              <ul className="space-y-1.5">
                {summary.recommendations.slice(0, 3).map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <ChevronRight className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : node.valuePreview ? (
        <div className="p-3 bg-slate-800/30 rounded-lg">
          <p className="text-sm text-slate-300 leading-relaxed">{node.valuePreview}</p>
          <button
            onClick={onGenerate}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300"
          >
            <Sparkles className="w-3 h-3" />
            Generate AI Summary
          </button>
        </div>
      ) : (
        <div className="p-4 bg-slate-800/20 rounded-lg text-center">
          <p className="text-sm text-slate-500">No summary available</p>
          <button
            onClick={onGenerate}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300"
          >
            <Sparkles className="w-3 h-3" />
            Generate with AI
          </button>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function NodeDrawer({ className = '' }: NodeDrawerProps) {
  const {
    selectedNode,
    setSelectedNode,
    nodeInsights,
    nodeSummaries,
    isAILoading,
    setIsAILoading,
    setNodeInsights,
    setNodeSummary,
    mapGraph,
    companyId,
    enterFocusMode,
    globalInsights,
  } = useStrategicMap();

  // Section collapse states
  const [sectionsOpen, setSectionsOpen] = useState({
    fields: true,
    connections: true,
    brainInsights: true,
    insights: true,
    work: true,
  });

  // Related work items (would be fetched from API)
  const [relatedWorkItems, setRelatedWorkItems] = useState<WorkItem[]>([]);
  const [isLoadingWork, setIsLoadingWork] = useState(false);

  // Propose fix loading state
  const [isProposingFix, setIsProposingFix] = useState(false);

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Generate AI summary handler
  const handleGenerateSummary = useCallback(async () => {
    if (!selectedNode) return;

    setIsAILoading(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/map/node-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNode.id,
          nodeLabel: selectedNode.label,
          nodeDomain: selectedNode.domain,
          fieldPaths: selectedNode.fieldPaths,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNodeSummary(selectedNode.id, data);
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsAILoading(false);
    }
  }, [selectedNode, companyId, setIsAILoading, setNodeSummary]);

  // Generate AI insights handler
  const handleGenerateInsights = useCallback(async () => {
    if (!selectedNode) return;

    setIsAILoading(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/map/node-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNode.id,
          nodeLabel: selectedNode.label,
          nodeDomain: selectedNode.domain,
          fieldPaths: selectedNode.fieldPaths,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNodeInsights(selectedNode.id, data.insights || []);
      }
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setIsAILoading(false);
    }
  }, [selectedNode, companyId, setIsAILoading, setNodeInsights]);

  // Propose fix handler
  const handleProposeFix = useCallback(async () => {
    if (!selectedNode) return;

    setIsProposingFix(true);
    try {
      // This would call an AI endpoint to propose fixes
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulated
      // Open assistant or show modal with proposed fix
    } catch (error) {
      console.error('Failed to propose fix:', error);
    } finally {
      setIsProposingFix(false);
    }
  }, [selectedNode]);

  // Create work item handler
  const handleCreateWorkItem = useCallback(async () => {
    if (!selectedNode) return;

    // Navigate to work creation with pre-filled context
    window.location.href = `/c/${companyId}/work/new?source=strategic_map&nodeId=${selectedNode.id}&nodeLabel=${encodeURIComponent(selectedNode.label)}`;
  }, [selectedNode, companyId]);

  // Derived data
  const insights = selectedNode ? nodeInsights[selectedNode.id] || [] : [];
  const summary = selectedNode ? nodeSummaries[selectedNode.id] : null;

  // Brain insights linked to this node (from insightIds or globalInsights)
  const linkedBrainInsights = useMemo((): ClientInsight[] => {
    if (!selectedNode) return [];

    // First check if node has insightIds from the map building
    if (selectedNode.insightIds && selectedNode.insightIds.length > 0) {
      return globalInsights.filter(i => selectedNode.insightIds.includes(i.id));
    }

    // Fallback: match by contextPaths
    return globalInsights.filter(insight => {
      if (!insight.contextPaths) return false;
      return insight.contextPaths.some(path => {
        const pathDomain = path.split('.')[0];
        return pathDomain === selectedNode.domain ||
          selectedNode.fieldPaths.some(fp => fp === path || path.startsWith(fp + '.') || fp.startsWith(path + '.'));
      });
    });
  }, [selectedNode, globalInsights]);

  // Get connected nodes with preview data
  const connectionPreviews = useMemo((): { upstream: ConnectedNodePreview[]; downstream: ConnectedNodePreview[] } => {
    if (!selectedNode) return { upstream: [], downstream: [] };

    const upstream: ConnectedNodePreview[] = [];
    const downstream: ConnectedNodePreview[] = [];

    // Helper to get edge relevance description
    const getEdgeRelevance = (edgeType: string, nodeName: string, direction: 'upstream' | 'downstream'): string => {
      const typeLabels: Record<string, { upstream: string; downstream: string }> = {
        'supports': { upstream: 'Supports', downstream: 'Supported by' },
        'informs': { upstream: 'Informs', downstream: 'Informed by' },
        'depends_on': { upstream: 'Required by', downstream: 'Depends on' },
        'contrasts': { upstream: 'Contrasts with', downstream: 'Contrasts with' },
        'competes_with': { upstream: 'Competes with', downstream: 'Competes with' },
      };
      const label = typeLabels[edgeType]?.[direction] || (direction === 'upstream' ? 'Required by' : 'Feeds into');
      return `${label} ${nodeName}`;
    };

    for (const edge of mapGraph.edges) {
      if (edge.from === selectedNode.id) {
        const toNode = mapGraph.nodes.find(n => n.id === edge.to);
        if (toNode) {
          downstream.push({
            node: toNode,
            direction: 'downstream',
            edgeStrength: edge.style === 'strong_alignment' ? 'strong' :
                          edge.style === 'ai_inferred' ? 'inferred' : 'weak',
            relevance: getEdgeRelevance(edge.type, toNode.label, 'downstream'),
          });
        }
      }
      if (edge.to === selectedNode.id) {
        const fromNode = mapGraph.nodes.find(n => n.id === edge.from);
        if (fromNode) {
          upstream.push({
            node: fromNode,
            direction: 'upstream',
            edgeStrength: edge.style === 'strong_alignment' ? 'strong' :
                          edge.style === 'ai_inferred' ? 'inferred' : 'weak',
            relevance: getEdgeRelevance(edge.type, fromNode.label, 'upstream'),
          });
        }
      }
    }

    return { upstream, downstream };
  }, [selectedNode, mapGraph]);

  // Field values grouped
  const fieldGroups: FieldGroup[] = useMemo(() => {
    if (!selectedNode) return [];

    const fields: FieldValue[] = selectedNode.fieldPaths.map(path => ({
      path,
      label: formatFieldLabel(path),
      value: selectedNode.valuePreview || null,
      source: selectedNode.provenanceKind,
      confidence: selectedNode.confidence === 'high' ? 0.9 : selectedNode.confidence === 'medium' ? 0.6 : 0.3,
      isLocked: false,
    }));

    return groupFieldsByDomain(fields);
  }, [selectedNode]);

  // Fetch related work items
  useEffect(() => {
    if (!selectedNode) return;

    const fetchWorkItems = async () => {
      setIsLoadingWork(true);
      try {
        // This would fetch work items related to this node
        const response = await fetch(`/api/os/companies/${companyId}/work?nodeId=${selectedNode.id}`);
        if (response.ok) {
          const data = await response.json();
          setRelatedWorkItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch work items:', error);
      } finally {
        setIsLoadingWork(false);
      }
    };

    fetchWorkItems();
  }, [selectedNode, companyId]);

  if (!selectedNode) return null;

  const domainColor = DOMAIN_COLORS[selectedNode.domain];
  const heatmapColor = getHeatmapColor(selectedNode.completenessScore);

  return (
    <div className={`flex flex-col bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden ${className}`}>
      {/* ================================================================== */}
      {/* Header */}
      {/* ================================================================== */}
      <div
        className="px-4 py-4 border-b border-slate-800"
        style={{ background: `linear-gradient(135deg, ${domainColor}15 0%, transparent 100%)` }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p
                className="text-[10px] font-medium uppercase tracking-wider"
                style={{ color: domainColor }}
              >
                {DOMAIN_LABELS[selectedNode.domain]}
              </p>
              <CriticalityChip criticality={selectedNode.criticality} />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 truncate">
              {selectedNode.label}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => enterFocusMode(selectedNode.id)}
              className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
              title="Focus mode"
            >
              <Target className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <CompletenessChip completeness={selectedNode.completeness} />
          <ConfidenceChip confidence={selectedNode.confidence} />
          <SourceChip source={selectedNode.provenanceKind} />
        </div>

        {/* Health Scores */}
        <div className="space-y-1.5 p-2.5 bg-slate-800/30 rounded-lg">
          <ScoreIndicator label="Completeness" score={selectedNode.completenessScore} />
          <ScoreIndicator label="Confidence" score={selectedNode.confidenceScore} />
          <ScoreIndicator label="Freshness" score={selectedNode.freshnessScore} />
        </div>

        {/* Conflicts */}
        {selectedNode.conflictFlags.length > 0 && (
          <div className="mt-3">
            <ConflictBadge conflicts={selectedNode.conflictFlags} />
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Scrollable Content */}
      {/* ================================================================== */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 space-y-5">

          {/* ============================================================ */}
          {/* AI Summary Section */}
          {/* ============================================================ */}
          <AISummarySection
            summary={summary}
            isLoading={isAILoading}
            onGenerate={handleGenerateSummary}
            node={selectedNode}
          />

          {/* ============================================================ */}
          {/* Field Details Section */}
          {/* ============================================================ */}
          {fieldGroups.length > 0 && (
            <section>
              <SectionHeader
                title="Field Details"
                icon={FileText}
                count={selectedNode.fieldPaths.length}
                isCollapsible
                isOpen={sectionsOpen.fields}
                onToggle={() => toggleSection('fields')}
                action={
                  <Link
                    href={`/c/${companyId}/brain/context?section=${selectedNode.domain}`}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit All
                  </Link>
                }
              />
              {sectionsOpen.fields && (
                <div className="space-y-4">
                  {fieldGroups.map(group => (
                    <div key={group.name}>
                      <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">
                        {group.name}
                      </p>
                      <div className="divide-y divide-slate-800/50">
                        {group.fields.map(field => (
                          <EditableFieldRow key={field.path} field={field} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ============================================================ */}
          {/* Connections Section */}
          {/* ============================================================ */}
          {(connectionPreviews.upstream.length > 0 || connectionPreviews.downstream.length > 0) && (
            <section>
              <SectionHeader
                title="Connections"
                icon={Link2}
                count={connectionPreviews.upstream.length + connectionPreviews.downstream.length}
                isCollapsible
                isOpen={sectionsOpen.connections}
                onToggle={() => toggleSection('connections')}
              />
              {sectionsOpen.connections && (
                <div className="space-y-4">
                  {connectionPreviews.upstream.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        Upstream ({connectionPreviews.upstream.length})
                      </p>
                      <div className="space-y-2">
                        {connectionPreviews.upstream.map(preview => (
                          <ConnectionPreviewCard
                            key={preview.node.id}
                            preview={preview}
                            onClick={() => setSelectedNode(preview.node)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {connectionPreviews.downstream.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3" />
                        Downstream ({connectionPreviews.downstream.length})
                      </p>
                      <div className="space-y-2">
                        {connectionPreviews.downstream.map(preview => (
                          <ConnectionPreviewCard
                            key={preview.node.id}
                            preview={preview}
                            onClick={() => setSelectedNode(preview.node)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ============================================================ */}
          {/* Brain Insights Section (from Brain → Insights) */}
          {/* ============================================================ */}
          {linkedBrainInsights.length > 0 && (
            <section>
              <SectionHeader
                title="Brain Insights"
                icon={Lightbulb}
                count={linkedBrainInsights.length}
                isCollapsible
                isOpen={sectionsOpen.brainInsights}
                onToggle={() => toggleSection('brainInsights')}
                action={
                  <Link
                    href={`/c/${companyId}/brain/insights?nodeId=${selectedNode?.id}`}
                    className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    View All
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                }
              />
              {sectionsOpen.brainInsights && (
                <div className="space-y-2">
                  {linkedBrainInsights.slice(0, 5).map(insight => (
                    <BrainInsightCard
                      key={insight.id}
                      insight={insight}
                      companyId={companyId}
                    />
                  ))}
                  {linkedBrainInsights.length > 5 && (
                    <Link
                      href={`/c/${companyId}/brain/insights?nodeId=${selectedNode?.id}`}
                      className="w-full block py-2 text-xs text-slate-500 hover:text-slate-400 text-center"
                    >
                      View {linkedBrainInsights.length - 5} more insights
                    </Link>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ============================================================ */}
          {/* AI Insights Section */}
          {/* ============================================================ */}
          <section>
            <SectionHeader
              title="AI Insights"
              icon={Lightbulb}
              count={insights.length}
              isCollapsible
              isOpen={sectionsOpen.insights}
              onToggle={() => toggleSection('insights')}
              action={
                <button
                  onClick={handleGenerateInsights}
                  disabled={isAILoading}
                  className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 disabled:opacity-50"
                >
                  {isAILoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Generate
                </button>
              }
            />
            {sectionsOpen.insights && (
              insights.length > 0 ? (
                <div className="space-y-2">
                  {insights.slice(0, 5).map(insight => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                  {insights.length > 5 && (
                    <button className="w-full py-2 text-xs text-slate-500 hover:text-slate-400 text-center">
                      View {insights.length - 5} more insights
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-800/20 rounded-lg text-center">
                  <Lightbulb className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No insights yet</p>
                  <button
                    onClick={handleGenerateInsights}
                    disabled={isAILoading}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50"
                  >
                    {isAILoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Generate Insights
                  </button>
                </div>
              )
            )}
          </section>

          {/* ============================================================ */}
          {/* Related Work Items Section */}
          {/* ============================================================ */}
          <section>
            <SectionHeader
              title="Related Work"
              icon={FileText}
              count={relatedWorkItems.length}
              isCollapsible
              isOpen={sectionsOpen.work}
              onToggle={() => toggleSection('work')}
            />
            {sectionsOpen.work && (
              isLoadingWork ? (
                <div className="flex items-center gap-2 p-4 bg-slate-800/30 rounded-lg">
                  <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  <span className="text-sm text-slate-400">Loading work items...</span>
                </div>
              ) : relatedWorkItems.length > 0 ? (
                <div className="space-y-2">
                  {relatedWorkItems.slice(0, 3).map(item => (
                    <WorkItemCard key={item.id} workItem={item} />
                  ))}
                  {relatedWorkItems.length > 3 && (
                    <Link
                      href={`/c/${companyId}/work?nodeId=${selectedNode.id}`}
                      className="w-full block py-2 text-xs text-slate-500 hover:text-slate-400 text-center"
                    >
                      View {relatedWorkItems.length - 3} more items
                    </Link>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-800/20 rounded-lg text-center">
                  <FileText className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No related work items</p>
                </div>
              )
            )}
          </section>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Footer - CTA Buttons */}
      {/* ================================================================== */}
      <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50">
        <div className="grid grid-cols-2 gap-2">
          <CTAButton
            label="Edit in Context"
            icon={ExternalLink}
            variant="primary"
            href={`/c/${companyId}/brain/context?section=${selectedNode.domain}`}
          />
          <CTAButton
            label="Ask AI"
            icon={MessageSquare}
            variant="accent"
            href={`/c/${companyId}/assistant?context=map&nodeId=${selectedNode.id}`}
          />
          <CTAButton
            label="Propose Fix"
            icon={Wrench}
            variant="default"
            onClick={handleProposeFix}
            loading={isProposingFix}
          />
          <CTAButton
            label="Create Work Item"
            icon={PlusCircle}
            variant="default"
            onClick={handleCreateWorkItem}
          />
        </div>
        {/* Competition Lab deep link for competitive domain nodes */}
        {selectedNode.domain === 'competitive' && (
          <div className="mt-2 pt-2 border-t border-slate-800/50">
            <CTAButton
              label="Open Competition Lab"
              icon={Target}
              variant="primary"
              href={`/c/${companyId}/brain/labs/competition`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
