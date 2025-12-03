// components/os/blueprint/BlueprintDimensionGrid.tsx
// Grid display of dimension scores (Brand, Content, SEO, Website, Demand, Ops)
// Shows score, status pill, one-line diagnosis, and visual score bar

'use client';

import { getScoreColor, getScoreStatusColor } from './utils';
import type { BlueprintPipelineData } from './types';

interface DimensionScore {
  id: string;
  label: string;
  score: number | null;
  diagnosis?: string;
}

interface BlueprintDimensionGridProps {
  pipelineData?: BlueprintPipelineData | null;
  className?: string;
}

// Map pipeline scores to dimension data
function getDimensionsFromPipeline(pipelineData: BlueprintPipelineData | null): DimensionScore[] {
  if (!pipelineData?.diagnostics?.scores) {
    return [];
  }

  const scores = pipelineData.diagnostics.scores;
  const dimensions: DimensionScore[] = [];

  // Define dimension order and labels
  const dimensionConfig: { key: keyof typeof scores; label: string }[] = [
    { key: 'website', label: 'Website & UX' },
    { key: 'brand', label: 'Brand & Positioning' },
    { key: 'seo', label: 'SEO & Search' },
    { key: 'content', label: 'Content & Messaging' },
  ];

  for (const { key, label } of dimensionConfig) {
    const score = scores[key];
    if (score !== null && score !== undefined) {
      dimensions.push({
        id: key,
        label,
        score,
      });
    }
  }

  return dimensions;
}

function DimensionCard({ dimension }: { dimension: DimensionScore }) {
  const { score, label } = dimension;
  const status = getScoreStatusColor(score);

  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-3 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-slate-200">{label}</h4>
        <span className={`text-lg font-bold tabular-nums ${getScoreColor(score)}`}>
          {score ?? '--'}
        </span>
      </div>

      {/* Status pill */}
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${status.bg} ${status.text} ${status.border}`}>
        {status.label}
      </span>

      {/* Score bar */}
      <div className="mt-3 h-1.5 rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${
            score !== null && score >= 80 ? 'bg-emerald-400' :
            score !== null && score >= 60 ? 'bg-amber-400' :
            score !== null && score >= 40 ? 'bg-orange-400' :
            score !== null ? 'bg-red-400' : 'bg-slate-600'
          }`}
          style={{ width: score !== null ? `${Math.min(score, 100)}%` : '0%' }}
        />
      </div>
    </div>
  );
}

function EmptyDimensionState() {
  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 border-dashed p-4 text-center">
      <p className="text-xs text-slate-500">
        No dimension scores available. Run diagnostics to generate scores.
      </p>
    </div>
  );
}

export function BlueprintDimensionGrid({ pipelineData, className = '' }: BlueprintDimensionGridProps) {
  const dimensions = getDimensionsFromPipeline(pipelineData ?? null);

  if (dimensions.length === 0) {
    return <EmptyDimensionState />;
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
      {dimensions.map((dimension) => (
        <DimensionCard key={dimension.id} dimension={dimension} />
      ))}
    </div>
  );
}
