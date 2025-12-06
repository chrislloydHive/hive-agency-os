// app/c/[companyId]/brain/context/components/CompetitiveLandscapePanel.tsx
// Competitive Landscape Panel for Brain → Context page
//
// Displays:
// - Competitor table with category, positioning, strengths/weaknesses
// - Positioning map (2×2 grid) with axes
// - Position sliders for own position
// - Inline editing for competitors

'use client';

import { useState, useCallback } from 'react';
import type { CompetitorProfile, PositioningAxes } from '@/lib/contextGraph/domains/competitive';

// ============================================================================
// Types
// ============================================================================

interface CompetitiveLandscapePanelProps {
  companyId: string;
  companyName: string;
  competitors: CompetitorProfile[];
  positioningAxes: PositioningAxes | null;
  ownPositionPrimary: number | null;
  ownPositionSecondary: number | null;
  positioningSummary: string | null;
  onUpdate?: (path: string, value: unknown) => Promise<void>;
  readOnly?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getCategoryColor(category: string | null): string {
  switch (category) {
    case 'direct':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'indirect':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'aspirational':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'emerging':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function getCategoryLabel(category: string | null): string {
  switch (category) {
    case 'direct':
      return 'Direct';
    case 'indirect':
      return 'Indirect';
    case 'aspirational':
      return 'Aspirational';
    case 'emerging':
      return 'Emerging';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Positioning Map Component
// ============================================================================

function PositioningMap({
  competitors,
  axes,
  ownX,
  ownY,
  companyName,
}: {
  competitors: CompetitorProfile[];
  axes: PositioningAxes | null;
  ownX: number | null;
  ownY: number | null;
  companyName: string;
}) {
  if (!axes?.primaryAxis || !axes?.secondaryAxis) {
    return (
      <div className="h-64 flex items-center justify-center bg-slate-800/30 rounded-lg border border-slate-700/50">
        <p className="text-sm text-slate-500">
          No positioning axes defined. Run Brand Lab to generate.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-80 bg-slate-800/30 rounded-lg border border-slate-700/50 p-4">
      {/* Axis Labels */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-slate-400">
        {axes.secondaryAxis.highLabel}
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-slate-400">
        {axes.secondaryAxis.lowLabel}
      </div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 [writing-mode:vertical-lr] rotate-180">
        {axes.primaryAxis.lowLabel}
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 [writing-mode:vertical-lr] rotate-180">
        {axes.primaryAxis.highLabel}
      </div>

      {/* Grid */}
      <div className="absolute inset-8 border border-slate-600/50">
        <div className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-slate-600/50" />
        <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-slate-600/50" />
      </div>

      {/* Plot Area */}
      <div className="absolute inset-8">
        {/* Competitors - only show those with explicit positions */}
        {competitors
          .filter((comp) => comp.positionPrimary != null && comp.positionSecondary != null)
          .map((comp, idx) => {
          const x = comp.positionPrimary!;
          const y = comp.positionSecondary!;
          return (
            <div
              key={comp.name + idx}
              className="absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
              style={{
                left: `${x}%`,
                bottom: `${y}%`,
              }}
            >
              <div className={`w-3 h-3 rounded-full border ${getCategoryColor(comp.category)}`} />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded shadow-lg">
                {comp.name}
              </div>
            </div>
          );
        })}

        {/* Own Position */}
        {ownX !== null && ownY !== null && (
          <div
            className="absolute w-5 h-5 rounded-full transform -translate-x-1/2 -translate-y-1/2 group"
            style={{
              left: `${ownX}%`,
              bottom: `${ownY}%`,
            }}
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-emerald-400 shadow-lg shadow-emerald-500/30" />
            <div className="absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-2 py-1 rounded shadow-lg">
              {companyName} (You)
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 right-2 flex flex-wrap gap-2 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-400">You</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500/50" />
          <span className="text-slate-400">Direct</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500/50" />
          <span className="text-slate-400">Indirect</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-purple-500/50" />
          <span className="text-slate-400">Aspirational</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Position Slider Component
// ============================================================================

function PositionSlider({
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
  disabled,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300 font-medium">{value ?? 50}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-slate-500 w-16 truncate">{lowLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value ?? 50}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500
            [&::-webkit-slider-thumb]:cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="text-[10px] text-slate-500 w-16 truncate text-right">{highLabel}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompetitiveLandscapePanel({
  companyId,
  companyName,
  competitors,
  positioningAxes,
  ownPositionPrimary,
  ownPositionSecondary,
  positioningSummary,
  onUpdate,
  readOnly = false,
}: CompetitiveLandscapePanelProps) {
  const [localOwnX, setLocalOwnX] = useState(ownPositionPrimary);
  const [localOwnY, setLocalOwnY] = useState(ownPositionSecondary);
  const [isSaving, setIsSaving] = useState(false);

  // Handle position change with debounced save
  const handlePositionChange = useCallback(
    async (axis: 'primary' | 'secondary', value: number) => {
      if (axis === 'primary') {
        setLocalOwnX(value);
      } else {
        setLocalOwnY(value);
      }

      if (onUpdate && !readOnly) {
        setIsSaving(true);
        try {
          const path = axis === 'primary' ? 'competitive.ownPositionPrimary' : 'competitive.ownPositionSecondary';
          await onUpdate(path, value);
        } finally {
          setIsSaving(false);
        }
      }
    },
    [onUpdate, readOnly]
  );

  // Calculate autoSeeded statistics
  const autoSeededCount = competitors.filter(c => c.autoSeeded).length;
  const verifiedCount = competitors.filter(c => !c.autoSeeded).length;
  const isAllAiSeeded = competitors.length > 0 && verifiedCount === 0;

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
      {/* AI-Seeded Warning Banner */}
      {isAllAiSeeded && (
        <div className="flex items-center gap-3 px-4 py-3 bg-violet-500/10 border-b border-violet-500/30">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm text-violet-300">Competitive landscape is AI-generated</p>
            <p className="text-xs text-violet-400/70">Review and verify competitors to finalize this section.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Competitive Landscape</h3>
            <p className="text-xs text-slate-400">
              {verifiedCount > 0 ? (
                <span>{verifiedCount} verified, {autoSeededCount} AI-suggested</span>
              ) : autoSeededCount > 0 ? (
                <span className="text-violet-400">{autoSeededCount} AI-suggested competitor(s)</span>
              ) : (
                <span>{competitors.length} competitor(s) tracked</span>
              )}
            </p>
          </div>
        </div>
        {isSaving && (
          <span className="text-xs text-slate-400 animate-pulse">Saving...</span>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Positioning Summary */}
        {positioningSummary && (
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-sm text-slate-300">{positioningSummary}</p>
          </div>
        )}

        {/* Positioning Map */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            Positioning Map
          </h4>
          <PositioningMap
            competitors={competitors}
            axes={positioningAxes}
            ownX={localOwnX}
            ownY={localOwnY}
            companyName={companyName}
          />
        </div>

        {/* Position Sliders */}
        {positioningAxes && (
          <div className="grid grid-cols-2 gap-4">
            {positioningAxes.primaryAxis && (
              <PositionSlider
                label="Primary Axis"
                lowLabel={positioningAxes.primaryAxis.lowLabel}
                highLabel={positioningAxes.primaryAxis.highLabel}
                value={localOwnX}
                onChange={(v) => handlePositionChange('primary', v)}
                disabled={readOnly}
              />
            )}
            {positioningAxes.secondaryAxis && (
              <PositionSlider
                label="Secondary Axis"
                lowLabel={positioningAxes.secondaryAxis.lowLabel}
                highLabel={positioningAxes.secondaryAxis.highLabel}
                value={localOwnY}
                onChange={(v) => handlePositionChange('secondary', v)}
                disabled={readOnly}
              />
            )}
          </div>
        )}

        {/* Competitor Table */}
        <div>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            Competitors
          </h4>
          {competitors.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500 bg-slate-800/30 rounded-lg">
              No competitors tracked yet. Run Competitor Lab to discover and analyze competitors.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Name</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Category</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Positioning</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Strengths</th>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium">Weaknesses</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((comp, idx) => (
                    <tr
                      key={comp.name + idx}
                      className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-200">{comp.name}</span>
                          {comp.autoSeeded && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded border border-violet-500/30">
                              AI suggested
                            </span>
                          )}
                        </div>
                        {comp.domain && (
                          <div className="text-xs text-slate-500">{comp.domain}</div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryColor(comp.category)}`}>
                          {getCategoryLabel(comp.category)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300 max-w-[200px] truncate">
                        {comp.positioning || '-'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {comp.strengths.slice(0, 2).map((s, i) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                              {s}
                            </span>
                          ))}
                          {comp.strengths.length > 2 && (
                            <span className="text-xs text-slate-500">+{comp.strengths.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {comp.weaknesses.slice(0, 2).map((w, i) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">
                              {w}
                            </span>
                          ))}
                          {comp.weaknesses.length > 2 && (
                            <span className="text-xs text-slate-500">+{comp.weaknesses.length - 2}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
