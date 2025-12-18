'use client';

// app/c/[companyId]/strategy/StrategyBlueprintClient.tsx
// Strategy Blueprint View - Visual Summary of Full Strategy
//
// Read-first visualization: Objectives → Strategy Frame → Strategic Bets → Tactical Plays → Work
// All edits route to Builder sections via deep links.

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Target,
  Users,
  Compass,
  Zap,
  Briefcase,
  ChevronRight,
  Lock,
  Unlock,
  AlertCircle,
  Plus,
  Edit3,
  Sparkles,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  Layers,
  FileText,
  ExternalLink,
} from 'lucide-react';
import type {
  CompanyStrategy,
  StrategyObjective,
  StrategyPlay,
  StrategyPillar,
  StrategyFrame,
  TacticChannel,
} from '@/lib/types/strategy';
import {
  normalizeObjectives,
  getObjectiveText,
  normalizePillarRisks,
  normalizePillarTradeoffs,
  hasEvaluationContent,
  TACTIC_CHANNEL_LABELS,
  TACTIC_CHANNEL_COLORS,
  PLAY_STATUS_LABELS,
  PLAY_STATUS_COLORS,
} from '@/lib/types/strategy';
import type { StrategyInputs } from '@/lib/os/strategy/strategyInputsHelpers';
import { computeStrategyReadiness } from '@/lib/os/strategy/strategyInputsHelpers';
import { EvaluationSummary } from '@/components/strategy/EvaluationEditor';

// ============================================================================
// Types
// ============================================================================

interface WorkPreviewItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  linkedObjectiveId?: string;
  linkedPriorityId?: string;
  linkedTacticId?: string;
}

interface StrategyBlueprintProps {
  companyId: string;
  companyName: string;
  strategy: CompanyStrategy | null;
  strategyInputs: StrategyInputs;
  workPreview?: WorkPreviewItem[];
  onSwitchToBuilder?: (section?: string) => void;
}

// ============================================================================
// Connector Line Component
// ============================================================================

function ConnectorLine({ className = '' }: { className?: string }) {
  return (
    <div className={`hidden lg:flex items-center justify-center ${className}`}>
      <div className="w-8 h-px bg-gradient-to-r from-slate-700 to-slate-600" />
      <ChevronRight className="w-4 h-4 text-slate-600 -ml-1" />
    </div>
  );
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: 'draft' | 'locked' | 'finalized' }) {
  const config = {
    draft: {
      icon: Unlock,
      label: 'Draft',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    locked: {
      icon: Lock,
      label: 'Locked',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    finalized: {
      icon: CheckCircle,
      label: 'Finalized',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
  };

  const { icon: Icon, label, className } = config[status] || config.draft;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ============================================================================
// Impact/Effort Badge
// ============================================================================

function ImpactBadge({ level }: { level?: 'low' | 'medium' | 'high' }) {
  if (!level) return null;
  const config = {
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${config[level]}`}>
      <TrendingUp className="w-2.5 h-2.5" />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function EffortBadge({ level }: { level?: 'low' | 'medium' | 'high' }) {
  if (!level) return null;
  const labels = { low: 'S', medium: 'M', high: 'L' };
  const config = {
    low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    high: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${config[level]}`}>
      {labels[level]}
    </span>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onCta,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
  onCta?: () => void;
}) {
  const ButtonOrLink = ctaHref ? Link : 'button';
  const props = ctaHref ? { href: ctaHref } : { onClick: onCta };

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-slate-500" />
      </div>
      <h4 className="text-sm font-medium text-slate-300 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 mb-4 max-w-[200px]">{description}</p>
      <ButtonOrLink
        {...(props as any)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
      >
        <Plus className="w-3 h-3" />
        {ctaLabel}
      </ButtonOrLink>
    </div>
  );
}

// ============================================================================
// Column Header Component
// ============================================================================

function ColumnHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  action,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-slate-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {badge}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          <Edit3 className="w-3 h-3" />
          {action.label}
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// Objectives Column
// ============================================================================

function ObjectivesColumn({
  companyId,
  objectives,
  status,
}: {
  companyId: string;
  objectives: StrategyObjective[];
  status: 'draft' | 'locked' | 'finalized';
}) {
  if (objectives.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <ColumnHeader
          icon={Target}
          title="Objectives"
          subtitle="What we're trying to achieve"
        />
        <EmptyState
          icon={Target}
          title="No Objectives"
          description="Define what success looks like for this strategy."
          ctaLabel="Add Objectives"
          ctaHref={`/c/${companyId}/strategy?view=builder#objectives`}
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <ColumnHeader
        icon={Target}
        title="Objectives"
        subtitle={`${objectives.length} objective${objectives.length !== 1 ? 's' : ''}`}
        badge={<StatusBadge status={status} />}
        action={{ label: 'Edit', href: `/c/${companyId}/strategy?view=builder#objectives` }}
      />
      <div className="space-y-3">
        {objectives.map((obj, idx) => (
          <div
            key={obj.id || idx}
            className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
          >
            <p className="text-sm text-slate-200">{obj.text}</p>
            {(obj.metric || obj.target) && (
              <div className="flex items-center gap-2 mt-2">
                {obj.metric && (
                  <span className="text-xs text-slate-400">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    {obj.metric}
                  </span>
                )}
                {obj.target && (
                  <span className="text-xs text-emerald-400 font-medium">{obj.target}</span>
                )}
              </div>
            )}
            {obj.timeframe && (
              <div className="flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span className="text-xs text-slate-500">{obj.timeframe}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Strategy Frame Card
// ============================================================================

function StrategyFrameCard({
  companyId,
  frame,
  completeness,
}: {
  companyId: string;
  frame?: StrategyFrame;
  completeness: number;
}) {
  // Use new canonical field names with fallback to legacy
  const fields = [
    { key: 'audience', legacyKey: 'targetAudience', label: 'Target Audience', icon: Users, color: 'text-cyan-400' },
    { key: 'offering', legacyKey: 'primaryOffering', label: 'Offering', icon: Briefcase, color: 'text-purple-400' },
    { key: 'valueProp', legacyKey: 'valueProposition', label: 'Value Prop', icon: Zap, color: 'text-amber-400' },
    { key: 'positioning', legacyKey: 'positioning', label: 'Positioning', icon: Compass, color: 'text-emerald-400' },
    { key: 'constraints', legacyKey: 'constraints', label: 'Constraints', icon: AlertCircle, color: 'text-red-400' },
  ];

  const getFieldValue = (key: string, legacyKey: string) => {
    return frame?.[key as keyof StrategyFrame] || frame?.[legacyKey as keyof StrategyFrame];
  };

  const filledFields = fields.filter(f => getFieldValue(f.key, f.legacyKey));
  const isLocked = frame?.isLocked || false;

  return (
    <div className={`bg-slate-800/30 border rounded-lg p-4 ${isLocked ? 'border-amber-500/30' : 'border-slate-700/50'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Strategic Frame</h4>
          {isLocked && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded">
              <Lock className="w-2.5 h-2.5" />
              Locked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${completeness >= 80 ? 'bg-emerald-500' : completeness >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className={`text-[10px] ${completeness >= 80 ? 'text-emerald-400' : completeness >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {completeness}%
          </span>
        </div>
      </div>

      {filledFields.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-slate-500 mb-2">No frame defined yet.</p>
          <Link
            href={`/c/${companyId}/strategy?view=builder#strategic-frame`}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Define Strategic Frame
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filledFields.slice(0, 4).map(({ key, legacyKey, label, icon: Icon, color }) => {
            const value = getFieldValue(key, legacyKey);
            return (
              <div key={key} className="flex items-start gap-2">
                <Icon className={`w-3.5 h-3.5 ${color} mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-slate-500 uppercase">{label}</span>
                  <p className="text-xs text-slate-300 line-clamp-2">
                    {typeof value === 'string' ? value : Array.isArray(value) ? value.join(', ') : ''}
                  </p>
                </div>
              </div>
            );
          })}
          {/* Show success metrics and non-goals if available */}
          {frame?.successMetrics && frame.successMetrics.length > 0 && (
            <div className="flex items-start gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-slate-500 uppercase">Success Metrics</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {frame.successMetrics.slice(0, 2).map((metric, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded">
                      {metric}
                    </span>
                  ))}
                  {frame.successMetrics.length > 2 && (
                    <span className="text-[10px] text-slate-500">+{frame.successMetrics.length - 2}</span>
                  )}
                </div>
              </div>
            </div>
          )}
          {filledFields.length > 4 && (
            <p className="text-[10px] text-slate-500">+{filledFields.length - 4} more</p>
          )}
          <Link
            href={`/c/${companyId}/strategy?view=builder#strategic-frame`}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <Edit3 className="w-2.5 h-2.5" />
            Edit Frame
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Strategic Bets Card
// ============================================================================

function StrategicBetsCard({
  companyId,
  pillars,
}: {
  companyId: string;
  pillars: StrategyPillar[];
}) {
  const topPillars = pillars.slice(0, 3);

  if (pillars.length === 0) {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
          Strategic Bets
        </h4>
        <div className="text-center py-4">
          <p className="text-xs text-slate-500 mb-2">No strategic bets defined yet.</p>
          <Link
            href={`/c/${companyId}/strategy?view=builder#strategy-bets`}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Add Bets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Strategic Bets
        </h4>
        <Link
          href={`/c/${companyId}/strategy?view=builder#strategy-bets`}
          className="text-[10px] text-cyan-400 hover:text-cyan-300"
        >
          Edit
        </Link>
      </div>
      <div className="space-y-4">
        {topPillars.map((pillar, idx) => {
          // Normalize legacy fields to structured format for display
          const normalizedPillar = {
            ...pillar,
            tradeoffs: normalizePillarTradeoffs(pillar),
            risks: normalizePillarRisks(pillar),
          };

          return (
            <div key={pillar.id} className="border-l-2 border-purple-500/50 pl-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 font-medium">#{idx + 1}</span>
                <h5 className="text-sm font-medium text-slate-200">{pillar.title}</h5>
              </div>
              {pillar.rationale && (
                <div className="mt-1">
                  <span className="text-[10px] text-slate-500">Why: </span>
                  <span className="text-xs text-slate-400 line-clamp-1">{pillar.rationale}</span>
                </div>
              )}
              {pillar.services && pillar.services.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {pillar.services.slice(0, 3).map(service => (
                    <span
                      key={service}
                      className="px-1.5 py-0.5 text-[10px] bg-slate-700/50 text-slate-400 rounded"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              )}
              {/* Evaluation Summary */}
              {hasEvaluationContent(normalizedPillar) && (
                <div className="mt-2">
                  <EvaluationSummary evaluation={normalizedPillar} maxItems={2} />
                </div>
              )}
            </div>
          );
        })}
        {pillars.length > 3 && (
          <p className="text-[10px] text-slate-500 pl-3">+{pillars.length - 3} more priorities</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Strategy Column (Center)
// ============================================================================

function StrategyColumn({
  companyId,
  strategy,
  strategyInputs,
}: {
  companyId: string;
  strategy: CompanyStrategy | null;
  strategyInputs: StrategyInputs;
}) {
  const readiness = computeStrategyReadiness(strategyInputs);
  const status = strategy?.status === 'finalized' ? 'finalized' : (strategy?.lockState === 'locked' ? 'locked' : 'draft');

  if (!strategy) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <ColumnHeader
          icon={Compass}
          title="Strategy"
          subtitle="Your strategic direction"
        />
        <EmptyState
          icon={Compass}
          title="No Strategy"
          description="Create a strategy to guide your marketing efforts."
          ctaLabel="Create Strategy"
          ctaHref={`/c/${companyId}/strategy?view=builder`}
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <ColumnHeader
        icon={Compass}
        title="Strategy"
        subtitle={strategy.title || 'Marketing Strategy'}
        badge={<StatusBadge status={status} />}
        action={{ label: 'Edit', href: `/c/${companyId}/strategy?view=builder#strategy-frame` }}
      />

      {/* Summary */}
      {strategy.summary && (
        <div className="mb-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/30">
          <p className="text-sm text-slate-300 line-clamp-3">{strategy.summary}</p>
        </div>
      )}

      {/* Strategy Frame */}
      <StrategyFrameCard
        companyId={companyId}
        frame={strategy.strategyFrame}
        completeness={readiness.completenessPercent}
      />

      {/* Strategic Bets */}
      <div className="mt-4">
        <StrategicBetsCard
          companyId={companyId}
          pillars={strategy.pillars || []}
        />
      </div>

      {/* Tradeoffs (if defined) */}
      {strategy.tradeoffs && (strategy.tradeoffs.optimizesFor?.length || strategy.tradeoffs.sacrifices?.length) && (
        <div className="mt-4 bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Strategic Tradeoffs
          </h4>
          {strategy.tradeoffs.optimizesFor && strategy.tradeoffs.optimizesFor.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] text-emerald-500">Optimizes for: </span>
              <span className="text-xs text-slate-300">
                {strategy.tradeoffs.optimizesFor.join(', ')}
              </span>
            </div>
          )}
          {strategy.tradeoffs.sacrifices && strategy.tradeoffs.sacrifices.length > 0 && (
            <div>
              <span className="text-[10px] text-amber-500">Sacrifices: </span>
              <span className="text-xs text-slate-300">
                {strategy.tradeoffs.sacrifices.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tactics Column (Right)
// ============================================================================

function TacticsColumn({
  companyId,
  plays,
  pillars,
}: {
  companyId: string;
  plays: StrategyPlay[];
  pillars: StrategyPillar[];
}) {
  // Group plays by priority
  const playsByPriority = useMemo(() => {
    const grouped: Record<string, StrategyPlay[]> = { unassigned: [] };
    pillars.forEach(p => {
      grouped[p.id] = [];
    });

    plays.forEach(play => {
      if (play.priorityId && grouped[play.priorityId]) {
        grouped[play.priorityId].push(play);
      } else {
        grouped.unassigned.push(play);
      }
    });

    return grouped;
  }, [plays, pillars]);

  const pillarMap = useMemo(() => {
    const map: Record<string, StrategyPillar> = {};
    pillars.forEach(p => {
      map[p.id] = p;
    });
    return map;
  }, [pillars]);

  if (plays.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <ColumnHeader
          icon={Zap}
          title="Tactical Plays"
          subtitle="How we'll execute"
        />
        <EmptyState
          icon={Zap}
          title="No Tactics"
          description="Add tactical plays to execute your strategy."
          ctaLabel="AI Suggest Tactics"
          ctaHref={`/c/${companyId}/strategy?view=builder#strategy-plays`}
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <ColumnHeader
        icon={Zap}
        title="Tactical Plays"
        subtitle={`${plays.length} tactic${plays.length !== 1 ? 's' : ''}`}
        action={{ label: 'Edit', href: `/c/${companyId}/strategy?view=builder#strategy-plays` }}
      />

      <div className="space-y-4">
        {/* Plays grouped by priority */}
        {pillars.map(pillar => {
          const pillarPlays = playsByPriority[pillar.id] || [];
          if (pillarPlays.length === 0) return null;

          return (
            <div key={pillar.id}>
              <h5 className="text-xs font-medium text-purple-400 mb-2 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {pillar.title}
              </h5>
              <div className="space-y-2 ml-4">
                {pillarPlays.map(play => (
                  <PlayCard key={play.id} play={play} companyId={companyId} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Unassigned plays */}
        {playsByPriority.unassigned.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-slate-500 mb-2">Unassigned</h5>
            <div className="space-y-2 ml-4">
              {playsByPriority.unassigned.map(play => (
                <PlayCard key={play.id} play={play} companyId={companyId} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Suggest CTA */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <Link
          href={`/c/${companyId}/strategy?view=builder#strategy-plays`}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          AI Suggest More Tactics
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Play Card Component
// ============================================================================

function PlayCard({ play, companyId }: { play: StrategyPlay; companyId: string }) {
  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <div className="flex items-start justify-between gap-2">
        <h6 className="text-sm font-medium text-slate-200">{play.title}</h6>
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${PLAY_STATUS_COLORS[play.status]}`}>
          {PLAY_STATUS_LABELS[play.status]}
        </span>
      </div>

      {play.description && (
        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{play.description}</p>
      )}

      <div className="flex items-center gap-2 mt-2">
        <ImpactBadge level={play.impact} />
        <EffortBadge level={play.effort} />
        {play.channels && play.channels.length > 0 && (
          <div className="flex gap-1">
            {play.channels.slice(0, 2).map(channel => (
              <span
                key={channel}
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${TACTIC_CHANNEL_COLORS[channel]}`}
              >
                {TACTIC_CHANNEL_LABELS[channel]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Key Risks (compact view) */}
      {play.risks && play.risks.length > 0 && (
        <div className="mt-2 px-2 py-1.5 bg-red-500/5 border border-red-500/20 rounded text-xs">
          <span className="text-red-400 font-medium">Risk: </span>
          <span className="text-red-200/70">{play.risks[0].risk}</span>
          {play.risks.length > 1 && (
            <span className="text-slate-500 ml-1">+{play.risks.length - 1} more</span>
          )}
        </div>
      )}

      {/* Convert to Work button */}
      <button
        className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium text-slate-400 hover:text-slate-300 bg-slate-700/30 hover:bg-slate-700/50 rounded transition-colors"
      >
        <Briefcase className="w-3 h-3" />
        Convert to Work
      </button>
    </div>
  );
}

// ============================================================================
// Work Preview Strip
// ============================================================================

function WorkPreviewStrip({
  companyId,
  workItems,
}: {
  companyId: string;
  workItems: WorkPreviewItem[];
}) {
  if (workItems.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Upcoming Work</h3>
        </div>
        <Link
          href={`/c/${companyId}/work`}
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          View all
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {workItems.slice(0, 3).map(item => (
          <div
            key={item.id}
            className="flex-shrink-0 w-48 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                item.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                'bg-slate-500/10 text-slate-400'
              }`}>
                {item.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-slate-200 line-clamp-2">{item.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Blueprint Component
// ============================================================================

export function StrategyBlueprintClient({
  companyId,
  companyName,
  strategy,
  strategyInputs,
  workPreview = [],
}: StrategyBlueprintProps) {
  // Normalize objectives
  const objectives = useMemo(() => {
    if (!strategy?.objectives) return [];
    return normalizeObjectives(strategy.objectives);
  }, [strategy?.objectives]);

  const plays = strategy?.plays || [];
  const pillars = strategy?.pillars || [];
  const status = strategy?.status === 'finalized' ? 'finalized' : (strategy?.lockState === 'locked' ? 'locked' : 'draft');

  return (
    <div className="space-y-4">
      {/* Dev marker */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-blue-400 border border-blue-800 bg-blue-950/50 rounded px-2 py-1">
          <FileText className="w-3 h-3" />
          Strategy UI: Blueprint View
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Strategy Blueprint
          </h1>
          <p className="text-sm text-slate-500 mt-1">{companyName}</p>
        </div>
        <Link
          href={`/c/${companyId}/strategy?view=builder`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Edit in Builder
        </Link>
      </div>

      {/* Blueprint Flow Header */}
      <div className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Target className="w-3 h-3" />
          Objectives
        </span>
        <ArrowRight className="w-4 h-4 text-slate-600" />
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Compass className="w-3 h-3" />
          Strategy
        </span>
        <ArrowRight className="w-4 h-4 text-slate-600" />
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Zap className="w-3 h-3" />
          Tactics
        </span>
        <ArrowRight className="w-4 h-4 text-slate-600" />
        <span className="flex items-center gap-1 text-xs text-slate-400">
          <Briefcase className="w-3 h-3" />
          Work
        </span>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Objectives */}
        <ObjectivesColumn
          companyId={companyId}
          objectives={objectives}
          status={status}
        />

        {/* Center: Strategy */}
        <StrategyColumn
          companyId={companyId}
          strategy={strategy}
          strategyInputs={strategyInputs}
        />

        {/* Right: Tactics */}
        <TacticsColumn
          companyId={companyId}
          plays={plays}
          pillars={pillars}
        />
      </div>

      {/* Work Preview Strip */}
      <WorkPreviewStrip companyId={companyId} workItems={workPreview} />

      {/* Blueprint Legend */}
      <div className="flex items-center justify-center gap-6 py-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          Draft
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          Locked/Finalized
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-purple-400" />
          Priority
        </span>
      </div>
    </div>
  );
}
