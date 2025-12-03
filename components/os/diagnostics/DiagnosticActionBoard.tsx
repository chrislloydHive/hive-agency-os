// components/os/diagnostics/DiagnosticActionBoard.tsx
// Generic Diagnostic Action Board - Reusable UI Component
//
// This is the main action-first view for all diagnostics (Website, SEO, Brand, etc.)
// PRIMARY VIEW: What to do (Now / Next / Later)
// SECONDARY FEATURES: Themes, experiments, strategic projects, filters

'use client';

import { useState } from 'react';
import type { DiagnosticActionBoard, ActionFilters } from '@/lib/diagnostics/types';
import { filterActions } from '@/lib/diagnostics/types';
import { ActionBucketSection } from './ActionBucketSection';
import { ThemeGrid } from './ThemeGrid';
import { ExperimentsSection } from './ExperimentsSection';
import { StrategicProjectsSection } from './StrategicProjectsSection';
import { FilterBar } from './FilterBar';

type Props = {
  board: DiagnosticActionBoard;
  onSendToWork?: (actionId: string) => void;
};

export function DiagnosticActionBoard({ board, onSendToWork }: Props) {
  const [filters, setFilters] = useState<ActionFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters to each bucket
  const filteredNow = filterActions(board.now, filters);
  const filteredNext = filterActions(board.next, filters);
  const filteredLater = filterActions(board.later, filters);

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-100">
              {board.companyName || 'Diagnostic Results'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {board.targetUrl && (
                <span className="text-sm text-slate-400">{board.targetUrl}</span>
              )}
              {/* Tech Stack Badge */}
              {board.metadata?.custom?.techStack?.platform && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-xs font-medium text-slate-300"
                  title={`Detected: ${board.metadata.custom.techStack.signals?.join(', ') || 'Unknown signals'} (${board.metadata.custom.techStack.confidence}% confidence)`}
                >
                  <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  {board.metadata.custom.techStack.platform}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 capitalize">
              {board.diagnosticType} Diagnostics
            </p>
          </div>

          {/* Grade & Summary */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-100">
                  {board.gradeLabel?.toUpperCase() || 'DIAGNOSTIC'}
                </span>
                <span className="text-lg text-slate-400">
                  ({board.overallScore}/100)
                </span>
              </div>
              {/* Maturity & Data Confidence Badges */}
              {(board.metadata?.custom?.maturityStage || board.metadata?.custom?.dataConfidence) && (
                <div className="flex flex-wrap gap-2 ml-auto">
                  {board.metadata?.custom?.maturityStage && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      board.metadata.custom.maturityStage === 'established' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                      board.metadata.custom.maturityStage === 'scaling' ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' :
                      board.metadata.custom.maturityStage === 'emerging' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                      'bg-red-500/10 text-red-300 border-red-500/30'
                    }`}>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">Maturity:</span>
                      {String(board.metadata.custom.maturityStage).charAt(0).toUpperCase() + String(board.metadata.custom.maturityStage).slice(1)}
                    </span>
                  )}
                  {board.metadata?.custom?.dataConfidence && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        board.metadata.custom.dataConfidence.level === 'high' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                        board.metadata.custom.dataConfidence.level === 'medium' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' :
                        'bg-red-500/10 text-red-300 border-red-500/30'
                      }`}
                      title={board.metadata.custom.dataConfidence.reason || ''}
                    >
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">Data:</span>
                      {board.metadata.custom.dataConfidence.level} ({board.metadata.custom.dataConfidence.score}%)
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {board.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="space-y-8">
          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-slate-400 hover:text-slate-300"
            >
              {showFilters ? '✕ Hide Filters' : '☰ Show Filters'}
            </button>
            {hasActiveFilters && (
              <button
                onClick={() => setFilters({})}
                className="text-xs text-slate-500 hover:text-slate-400"
              >
                Clear all filters
              </button>
            )}
          </div>

          {showFilters && board.filterOptions && (
            <FilterBar
              filters={filters}
              filterOptions={board.filterOptions}
              onFiltersChange={setFilters}
            />
          )}

          {/* Key Themes Overview */}
          {board.themes && board.themes.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold text-slate-100">Key Themes</h2>
              <ThemeGrid themes={board.themes} />
            </section>
          )}

          {/* NOW Bucket */}
          <ActionBucketSection
            title="What to Do Now"
            subtitle="High-priority actions for immediate impact (0-30 days)"
            actions={filteredNow}
            originalCount={board.now.length}
            onSendToWork={onSendToWork}
            defaultOpen={true}
          />

          {/* NEXT Bucket */}
          <ActionBucketSection
            title="Next"
            subtitle="Medium-priority actions for sustained improvement (30-90 days)"
            actions={filteredNext}
            originalCount={board.next.length}
            onSendToWork={onSendToWork}
            defaultOpen={false}
          />

          {/* LATER Bucket */}
          <ActionBucketSection
            title="Later"
            subtitle="Lower-priority improvements for ongoing optimization (90+ days)"
            actions={filteredLater}
            originalCount={board.later.length}
            onSendToWork={onSendToWork}
            defaultOpen={false}
          />

          {/* Experiments */}
          {board.experiments && board.experiments.length > 0 && (
            <ExperimentsSection experiments={board.experiments} />
          )}

          {/* Strategic Projects */}
          {board.strategicProjects && board.strategicProjects.length > 0 && (
            <StrategicProjectsSection projects={board.strategicProjects} />
          )}
        </div>
      </div>
    </div>
  );
}
