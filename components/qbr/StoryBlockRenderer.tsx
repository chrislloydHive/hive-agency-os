// components/qbr/StoryBlockRenderer.tsx
// Renders story blocks for the QBR Story View

'use client';

import type {
  StoryBlock,
  SectionIntroBlock,
  NodeDeltasBlock,
  InsightClusterBlock,
  KpiChartBlock,
  AiParagraphBlock,
  RecommendationsBlock,
  MetaCalloutBlock,
  ContextIntegrityBlock,
  GlobalContextHealthBlock,
} from '@/lib/qbr/qbrTypes';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';

interface Props {
  blocks: StoryBlock[];
}

// Simple cn utility for class concatenation
function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function StoryBlockRenderer({ blocks }: Props) {
  const sorted = blocks.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((block) => {
        switch (block.kind) {
          case 'section_intro':
            return <SectionIntroRenderer key={block.id} block={block as SectionIntroBlock} />;

          case 'node_deltas':
            return <NodeDeltasRenderer key={block.id} block={block as NodeDeltasBlock} />;

          case 'insight_cluster':
            return <InsightClusterRenderer key={block.id} block={block as InsightClusterBlock} />;

          case 'kpi_chart':
            return <KpiChartRenderer key={block.id} block={block as KpiChartBlock} />;

          case 'ai_paragraph':
            return <AiParagraphRenderer key={block.id} block={block as AiParagraphBlock} />;

          case 'recommendations':
            return <RecommendationsRenderer key={block.id} block={block as RecommendationsBlock} />;

          case 'meta_callout':
            return <MetaCalloutRenderer key={block.id} block={block as MetaCalloutBlock} />;

          case 'context_integrity':
            return <ContextIntegrityRenderer key={block.id} block={block as ContextIntegrityBlock} />;

          case 'global_context_health':
            return <GlobalContextHealthRenderer key={block.id} block={block as GlobalContextHealthBlock} />;

          default:
            return null;
        }
      })}
    </div>
  );
}

// ============================================================================
// Block Renderers
// ============================================================================

function SectionIntroRenderer({ block }: { block: SectionIntroBlock }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-100">{block.title}</h3>
      {block.subtitle && (
        <p className="text-xs text-slate-400">{block.subtitle}</p>
      )}
      {block.summaryBullets.length > 0 && (
        <ul className="list-inside list-disc text-xs text-slate-300 space-y-1 mt-2">
          {block.summaryBullets.map((bullet, idx) => (
            <li key={idx}>{bullet}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NodeDeltasRenderer({ block }: { block: NodeDeltasBlock }) {
  if (block.graphDeltas.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      <p className="mb-3 text-xs font-semibold text-slate-300">
        Context Changes
      </p>
      <div className="grid gap-2 text-xs md:grid-cols-2">
        {block.graphDeltas.map((delta) => (
          <div
            key={delta.nodeId}
            className="flex flex-col rounded-md border border-slate-700/50 bg-slate-800/50 p-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-200">{delta.label}</span>
              <span
                className={cn(
                  'text-[10px] uppercase px-1.5 py-0.5 rounded',
                  delta.changeType === 'added' && 'bg-emerald-500/20 text-emerald-400',
                  delta.changeType === 'removed' && 'bg-red-500/20 text-red-400',
                  delta.changeType === 'strengthened' && 'bg-blue-500/20 text-blue-400',
                  delta.changeType === 'weakened' && 'bg-amber-500/20 text-amber-400'
                )}
              >
                {delta.changeType}
              </span>
            </div>
            {typeof delta.beforeScore === 'number' && typeof delta.afterScore === 'number' && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                <span>{delta.beforeScore}</span>
                <span className="text-slate-500">→</span>
                <span>{delta.afterScore}</span>
                {delta.delta !== undefined && (
                  <span
                    className={cn(
                      'ml-1',
                      delta.delta > 0 && 'text-emerald-400',
                      delta.delta < 0 && 'text-red-400'
                    )}
                  >
                    ({delta.delta > 0 ? '+' : ''}
                    {delta.delta})
                  </span>
                )}
              </div>
            )}
            {delta.comment && (
              <p className="mt-1 text-[11px] text-slate-500">{delta.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightClusterRenderer({ block }: { block: InsightClusterBlock }) {
  const clusterColors: Record<string, string> = {
    win: 'border-emerald-500/30 bg-emerald-500/5',
    regression: 'border-red-500/30 bg-red-500/5',
    risk: 'border-amber-500/30 bg-amber-500/5',
    opportunity: 'border-blue-500/30 bg-blue-500/5',
  };

  const clusterIcons: Record<string, React.ReactNode> = {
    win: <TrendingUp className="h-4 w-4 text-emerald-400" />,
    regression: <TrendingDown className="h-4 w-4 text-red-400" />,
    risk: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    opportunity: <Lightbulb className="h-4 w-4 text-blue-400" />,
  };

  return (
    <div className={cn('rounded-lg border p-3', clusterColors[block.clusterType] || 'border-slate-700')}>
      <div className="flex items-center gap-2 mb-2">
        {clusterIcons[block.clusterType]}
        <p className="text-xs font-semibold text-slate-200">{block.clusterLabel}</p>
      </div>
      <ul className="space-y-2 text-xs">
        {block.insights.map((insight) => (
          <li key={insight.id} className="flex flex-col gap-0.5">
            <span className="font-medium text-slate-300">{insight.title}</span>
            <span className="text-slate-400">{insight.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KpiChartRenderer({ block }: { block: KpiChartBlock }) {
  // TODO: Integrate with Recharts for actual visualization
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      <p className="text-xs font-semibold text-slate-300">{block.label}</p>
      <p className="mt-1 text-xs text-slate-500">
        KPI chart placeholder for metric {block.metricKey}
      </p>
      {block.comparative?.deltaPct !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {block.comparative.deltaPct > 0 ? (
            <ArrowUp className="h-3 w-3 text-emerald-400" />
          ) : block.comparative.deltaPct < 0 ? (
            <ArrowDown className="h-3 w-3 text-red-400" />
          ) : (
            <Minus className="h-3 w-3 text-slate-400" />
          )}
          <span
            className={cn(
              block.comparative.deltaPct > 0 && 'text-emerald-400',
              block.comparative.deltaPct < 0 && 'text-red-400',
              block.comparative.deltaPct === 0 && 'text-slate-400'
            )}
          >
            {block.comparative.deltaPct > 0 ? '+' : ''}
            {block.comparative.deltaPct}% vs previous
          </span>
        </div>
      )}
    </div>
  );
}

function AiParagraphRenderer({ block }: { block: AiParagraphBlock }) {
  return (
    <div className="text-xs leading-relaxed">
      {block.title && (
        <p className="mb-1.5 font-semibold text-slate-200">{block.title}</p>
      )}
      <p className="text-slate-300 whitespace-pre-wrap">{block.body}</p>
    </div>
  );
}

function RecommendationsRenderer({ block }: { block: RecommendationsBlock }) {
  const priorityColors: Record<string, string> = {
    now: 'bg-red-500/20 text-red-400',
    next: 'bg-amber-500/20 text-amber-400',
    later: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-200">{block.headline}</p>
        <span className={cn('text-[10px] uppercase px-1.5 py-0.5 rounded', priorityColors[block.priority])}>
          {block.priority}
        </span>
      </div>
      <ul className="space-y-2 text-xs">
        {block.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="font-medium text-slate-300">{item.title}</span>
              {item.description && item.description !== item.title && (
                <span className="text-slate-400"> - {item.description}</span>
              )}
              {(item.estimatedImpact || item.effort) && (
                <div className="flex gap-2 mt-1">
                  {item.estimatedImpact && (
                    <span className="text-[10px] text-slate-500">
                      Impact: {item.estimatedImpact}
                    </span>
                  )}
                  {item.effort && (
                    <span className="text-[10px] text-slate-500">
                      Effort: {item.effort}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetaCalloutRenderer({ block }: { block: MetaCalloutBlock }) {
  const toneStyles: Record<string, { bg: string; border: string; icon: React.ReactNode }> = {
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: <Info className="h-4 w-4 text-blue-400" />,
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    },
    success: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    },
  };

  const style = toneStyles[block.tone] || toneStyles.info;

  return (
    <div className={cn('rounded-lg border p-3', style.bg, style.border)}>
      <div className="flex items-center gap-2 mb-1">
        {style.icon}
        <p className="text-xs font-semibold text-slate-200">{block.title}</p>
      </div>
      <p className="text-xs text-slate-300 whitespace-pre-wrap">{block.body}</p>
    </div>
  );
}

function ContextIntegrityRenderer({ block }: { block: ContextIntegrityBlock }) {
  const hasIssues = block.conflicted > 0 || block.stale > 0 || block.lowConfidence > 0;

  if (!hasIssues && block.overrides === 0) return null;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-300">Context Integrity</p>
      <div className="grid grid-cols-4 gap-2 text-xs">
        {block.conflicted > 0 && (
          <div className="text-center p-2 rounded bg-red-500/10 border border-red-500/30">
            <p className="text-lg font-bold text-red-400">{block.conflicted}</p>
            <p className="text-[10px] text-slate-400">Conflicted</p>
          </div>
        )}
        {block.overrides > 0 && (
          <div className="text-center p-2 rounded bg-blue-500/10 border border-blue-500/30">
            <p className="text-lg font-bold text-blue-400">{block.overrides}</p>
            <p className="text-[10px] text-slate-400">Overrides</p>
          </div>
        )}
        {block.stale > 0 && (
          <div className="text-center p-2 rounded bg-amber-500/10 border border-amber-500/30">
            <p className="text-lg font-bold text-amber-400">{block.stale}</p>
            <p className="text-[10px] text-slate-400">Stale</p>
          </div>
        )}
        {block.lowConfidence > 0 && (
          <div className="text-center p-2 rounded bg-slate-500/10 border border-slate-500/30">
            <p className="text-lg font-bold text-slate-400">{block.lowConfidence}</p>
            <p className="text-[10px] text-slate-400">Low Confidence</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GlobalContextHealthRenderer({ block }: { block: GlobalContextHealthBlock }) {
  const { totals } = block;
  const hasIssues = totals.conflicted > 0 || totals.stale > 0 || totals.lowConfidence > 0;

  return (
    <div className={cn(
      'rounded-lg border p-3',
      hasIssues ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
    )}>
      <div className="flex items-center gap-2 mb-2">
        {hasIssues ? (
          <AlertTriangle className="h-4 w-4 text-amber-400" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        )}
        <p className="text-xs font-semibold text-slate-200">Context Health Summary</p>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center">
          <p className={cn('text-lg font-bold', totals.conflicted > 0 ? 'text-red-400' : 'text-slate-500')}>
            {totals.conflicted}
          </p>
          <p className="text-[10px] text-slate-400">Conflicted</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-blue-400">{totals.overrides}</p>
          <p className="text-[10px] text-slate-400">Overrides</p>
        </div>
        <div className="text-center">
          <p className={cn('text-lg font-bold', totals.stale > 0 ? 'text-amber-400' : 'text-slate-500')}>
            {totals.stale}
          </p>
          <p className="text-[10px] text-slate-400">Stale</p>
        </div>
        <div className="text-center">
          <p className={cn('text-lg font-bold', totals.lowConfidence > 0 ? 'text-slate-400' : 'text-slate-500')}>
            {totals.lowConfidence}
          </p>
          <p className="text-[10px] text-slate-400">Low Confidence</p>
        </div>
      </div>
    </div>
  );
}
