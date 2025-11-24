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
            {board.targetUrl && (
              <p className="mt-1 text-sm text-slate-400">{board.targetUrl}</p>
            )}
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
