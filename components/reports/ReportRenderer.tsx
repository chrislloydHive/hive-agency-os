'use client';

// components/reports/ReportRenderer.tsx
// Universal Report Renderer
//
// Renders CompanyReport blocks using shadcn/ui-inspired components.
// Supports all block types defined in lib/reports/types.ts

import type {
  CompanyReport,
  ReportBlock,
  SectionHeadingBlock,
  ParagraphBlock,
  InsightBlock,
  KpiChartBlock,
  DeltaBlock,
  RecommendationBlock,
  ListBlock,
  QuoteBlock,
  MetricBlock,
  SwotBlock,
  PillarBlock,
  InitiativeBlock,
  RiskBlock,
  BudgetMixBlock,
} from '@/lib/reports/types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  Target,
  Calendar,
  Shield,
  DollarSign,
} from 'lucide-react';

// ============================================================================
// Main Component
// ============================================================================

interface ReportRendererProps {
  report: CompanyReport;
  className?: string;
}

export function ReportRenderer({ report, className = '' }: ReportRendererProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {report.content.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}

// ============================================================================
// Block Router
// ============================================================================

function BlockRenderer({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case 'section_heading':
      return <SectionHeadingRenderer block={block as SectionHeadingBlock} />;
    case 'paragraph':
      return <ParagraphRenderer block={block as ParagraphBlock} />;
    case 'insight':
      return <InsightRenderer block={block as InsightBlock} />;
    case 'kpi_chart':
      return <KpiChartRenderer block={block as KpiChartBlock} />;
    case 'delta':
      return <DeltaRenderer block={block as DeltaBlock} />;
    case 'recommendation':
      return <RecommendationRenderer block={block as RecommendationBlock} />;
    case 'list':
      return <ListRenderer block={block as ListBlock} />;
    case 'quote':
      return <QuoteRenderer block={block as QuoteBlock} />;
    case 'metric_block':
      return <MetricBlockRenderer block={block as MetricBlock} />;
    case 'swot':
      return <SwotRenderer block={block as SwotBlock} />;
    case 'pillar':
      return <PillarRenderer block={block as PillarBlock} />;
    case 'initiative':
      return <InitiativeRenderer block={block as InitiativeBlock} />;
    case 'risk':
      return <RiskRenderer block={block as RiskBlock} />;
    case 'budget_mix':
      return <BudgetMixRenderer block={block as BudgetMixBlock} />;
    default:
      return (
        <div className="p-4 bg-slate-800/50 rounded-lg text-sm text-slate-400">
          Unknown block type: {(block as any).kind}
        </div>
      );
  }
}

// ============================================================================
// Block Renderers
// ============================================================================

function SectionHeadingRenderer({ block }: { block: SectionHeadingBlock }) {
  const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
  const sizeClass = block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg';

  return (
    <div className="pt-4 first:pt-0">
      <Tag className={`${sizeClass} font-semibold text-slate-100`}>{block.title}</Tag>
      {block.subtitle && (
        <p className="text-sm text-slate-400 mt-1">{block.subtitle}</p>
      )}
    </div>
  );
}

function ParagraphRenderer({ block }: { block: ParagraphBlock }) {
  return (
    <div className="space-y-2">
      {block.title && (
        <h4 className="text-sm font-medium text-slate-200">{block.title}</h4>
      )}
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
        {block.body}
      </p>
    </div>
  );
}

function InsightRenderer({ block }: { block: InsightBlock }) {
  const categoryConfig = {
    win: { icon: CheckCircle2, color: 'emerald', label: 'Win' },
    risk: { icon: AlertTriangle, color: 'red', label: 'Risk' },
    opportunity: { icon: Lightbulb, color: 'amber', label: 'Opportunity' },
    regression: { icon: AlertCircle, color: 'orange', label: 'Decline' },
  };

  const config = categoryConfig[block.category];
  const Icon = config.icon;

  const colorClasses = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
    red: 'border-red-500/30 bg-red-500/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
    orange: 'border-orange-500/30 bg-orange-500/10',
  }[config.color];

  const iconColor = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    orange: 'text-orange-400',
  }[config.color];

  return (
    <div className={`rounded-lg border ${colorClasses} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 ${iconColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-slate-100">{block.title}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${iconColor} bg-slate-800`}>
              {config.label}
            </span>
          </div>
          <p className="text-sm text-slate-300">{block.body}</p>
        </div>
      </div>
    </div>
  );
}

function KpiChartRenderer({ block }: { block: KpiChartBlock }) {
  // Simple sparkline placeholder - in production, use a charting library
  return (
    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-200">{block.label}</span>
        {block.comparative?.deltaPct !== undefined && (
          <span className={`text-xs ${block.comparative.deltaPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {block.comparative.deltaPct >= 0 ? '+' : ''}{block.comparative.deltaPct}%
          </span>
        )}
      </div>
      <div className="h-12 bg-slate-700/50 rounded flex items-center justify-center text-xs text-slate-500">
        Chart: {block.chartType}
      </div>
    </div>
  );
}

function DeltaRenderer({ block }: { block: DeltaBlock }) {
  const changeConfig = {
    added: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    removed: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
    strengthened: { icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    weakened: { icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  };

  const config = changeConfig[block.changeType];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${config.bg}`}>
      <Icon className={`w-4 h-4 ${config.color}`} />
      <div className="flex-1">
        <span className="text-sm text-slate-200">{block.label}</span>
        {block.beforeValue && block.afterValue && (
          <span className="text-xs text-slate-400 ml-2">
            {block.beforeValue} → {block.afterValue}
          </span>
        )}
      </div>
      {block.comment && (
        <span className="text-xs text-slate-400">{block.comment}</span>
      )}
    </div>
  );
}

function RecommendationRenderer({ block }: { block: RecommendationBlock }) {
  const priorityConfig = {
    now: { label: 'Do Now', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    next: { label: 'Do Next', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    later: { label: 'Do Later', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  };

  const config = priorityConfig[block.priority];

  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700">
        <h4 className="text-sm font-medium text-slate-100">{block.headline}</h4>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${config.color}`}>
          {config.label}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {block.items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <Target className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-200">{item.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListRenderer({ block }: { block: ListBlock }) {
  const ListTag = block.style === 'numbered' ? 'ol' : 'ul';
  const listClass = block.style === 'numbered' ? 'list-decimal' : 'list-disc';

  return (
    <div>
      {block.title && (
        <h4 className="text-sm font-medium text-slate-200 mb-2">{block.title}</h4>
      )}
      <ListTag className={`${listClass} list-inside space-y-1 text-sm text-slate-300`}>
        {block.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ListTag>
    </div>
  );
}

function QuoteRenderer({ block }: { block: QuoteBlock }) {
  return (
    <blockquote className="border-l-2 border-amber-500/50 pl-4 py-2">
      <p className="text-sm text-slate-200 italic">&ldquo;{block.text}&rdquo;</p>
      {block.attribution && (
        <p className="text-xs text-slate-400 mt-1">— {block.attribution}</p>
      )}
    </blockquote>
  );
}

function MetricBlockRenderer({ block }: { block: MetricBlock }) {
  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden">
      {block.title && (
        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
          <h4 className="text-sm font-medium text-slate-200">{block.title}</h4>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        {block.metrics.map((metric, i) => (
          <div key={i} className="text-center">
            <p className="text-xs text-slate-400">{metric.label}</p>
            <p className="text-xl font-semibold text-slate-100">{metric.value}</p>
            {metric.trend && (
              <div className="flex items-center justify-center gap-1 mt-1">
                {metric.trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                {metric.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
                {metric.trend === 'flat' && <Minus className="w-3 h-3 text-slate-400" />}
                {metric.delta && (
                  <span className={`text-xs ${
                    metric.trend === 'up' ? 'text-emerald-400' :
                    metric.trend === 'down' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {metric.delta}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SwotRenderer({ block }: { block: SwotBlock }) {
  const quadrants = [
    { label: 'Strengths', items: block.strengths, color: 'emerald' },
    { label: 'Weaknesses', items: block.weaknesses, color: 'red' },
    { label: 'Opportunities', items: block.opportunities, color: 'cyan' },
    { label: 'Threats', items: block.threats, color: 'amber' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {quadrants.map(({ label, items, color }) => (
        <div
          key={label}
          className={`rounded-lg border border-${color}-500/30 bg-${color}-500/5 p-4`}
        >
          <h5 className={`text-sm font-medium text-${color}-400 mb-2`}>{label}</h5>
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full bg-${color}-400 mt-1.5 flex-shrink-0`} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PillarRenderer({ block }: { block: PillarBlock }) {
  return (
    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-violet-500/20">
          <Target className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-100">{block.name}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{block.description}</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Objectives</p>
          <ul className="space-y-1">
            {block.objectives.map((obj, i) => (
              <li key={i} className="text-xs text-slate-300">• {obj}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Key Results</p>
          <ul className="space-y-1">
            {block.keyResults.map((kr, i) => (
              <li key={i} className="text-xs text-slate-300">• {kr}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function InitiativeRenderer({ block }: { block: InitiativeBlock }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-slate-700 bg-slate-800/30">
      <div className="p-2 rounded-lg bg-cyan-500/20">
        <Calendar className="w-4 h-4 text-cyan-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium text-slate-100">{block.name}</h4>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
            {block.quarter}
          </span>
        </div>
        <p className="text-xs text-slate-400">{block.description}</p>
        <p className="text-xs text-cyan-400 mt-2">Expected: {block.expectedOutcome}</p>
      </div>
    </div>
  );
}

function RiskRenderer({ block }: { block: RiskBlock }) {
  const likelihoodColor = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-red-400',
  };

  return (
    <div className="space-y-3">
      {block.risks.map((risk) => (
        <div key={risk.id} className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-red-400 mt-0.5" />
            <div className="flex-1">
              <h5 className="text-sm font-medium text-slate-100">{risk.title}</h5>
              <div className="flex gap-3 mt-1 text-xs">
                <span className={likelihoodColor[risk.likelihood]}>
                  Likelihood: {risk.likelihood}
                </span>
                <span className={likelihoodColor[risk.impact]}>
                  Impact: {risk.impact}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                <span className="text-slate-500">Mitigation:</span> {risk.mitigation}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BudgetMixRenderer({ block }: { block: BudgetMixBlock }) {
  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-emerald-400" />
        <h4 className="text-sm font-medium text-slate-200">Budget Allocation</h4>
        {block.totalBudget && (
          <span className="text-xs text-slate-400 ml-auto">
            Total: ${block.totalBudget.toLocaleString()}
          </span>
        )}
      </div>
      <div className="p-4 space-y-3">
        {block.allocations.map((alloc, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-200">{alloc.channel}</span>
              <span className="text-sm font-medium text-slate-100">{alloc.percentage}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                style={{ width: `${alloc.percentage}%` }}
              />
            </div>
            {alloc.rationale && (
              <p className="text-[10px] text-slate-500 mt-1">{alloc.rationale}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
