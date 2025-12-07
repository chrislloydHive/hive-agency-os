// app/c/[companyId]/qbr/story/QbrStoryClient.tsx
// QBR Story View - Main Client Component
//
// Integrates BrainSummary for:
// - Data Confidence widget in header
// - Context & Assumptions chapter
// - Lab status badges in chapter headers

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  QuarterSelector,
  RegenerationControls,
  StoryChapterNav,
  StoryBlockRenderer,
} from '@/components/qbr';
import {
  DataConfidenceWidget,
  ContextAssumptionsChapter,
  ChapterLabBadge,
} from '@/components/qbr/BrainSummaryWidget';
import type { QbrStory, RegenerationMode, QbrDomain } from '@/lib/qbr/qbrTypes';
import type { BrainSummary } from '@/lib/brain/summaryTypes';
import { Sparkles, BookOpen, RefreshCw, Swords } from 'lucide-react';

// Map QBR domains to Lab IDs for badge display
const DOMAIN_TO_LAB: Record<string, string> = {
  competitive: 'competition',
  brand: 'brand',
  audience: 'audience',
  creative: 'creative',
  website: 'website',
  seo: 'seo',
};

interface Props {
  companyId: string;
  quarter: string;
}

export function QbrStoryClient({ companyId, quarter }: Props) {
  const [story, setStory] = useState<QbrStory | null>(null);
  const [brainSummary, setBrainSummary] = useState<BrainSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing story and brain summary
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Fetch both in parallel
    Promise.all([
      fetch(`/api/os/companies/${companyId}/qbr/story?quarter=${quarter}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load story');
          return res.json();
        }),
      fetch(`/api/os/companies/${companyId}/brain/summary`)
        .then((res) => {
          if (!res.ok) {
            console.warn('[QbrStoryClient] BrainSummary fetch failed');
            return null;
          }
          return res.json();
        })
        .catch((err) => {
          console.warn('[QbrStoryClient] BrainSummary error:', err);
          return null;
        }),
    ])
      .then(([storyData, brainData]) => {
        if (!cancelled) {
          setStory(storyData);
          setBrainSummary(brainData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[QbrStoryClient] Load error:', err);
          setError('Failed to load QBR story');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, quarter]);

  // Generate new story
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/os/companies/${companyId}/qbr/story`, {
        method: 'POST',
        body: JSON.stringify({ quarter }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error('Failed to generate story');

      const data = await res.json();
      setStory(data);
    } catch (err) {
      console.error('[QbrStoryClient] Generate error:', err);
      setError('Failed to generate QBR story');
    } finally {
      setGenerating(false);
    }
  }, [companyId, quarter]);

  // Regenerate story or part of it
  const handleRegenerate = useCallback(async (opts: {
    mode: RegenerationMode;
    domain?: string;
  }) => {
    if (!story) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/os/companies/${companyId}/qbr/story`, {
        method: 'PATCH',
        body: JSON.stringify({
          quarter,
          mode: opts.mode,
          domain: opts.domain as QbrDomain | 'all' | undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error('Failed to regenerate story');

      const data = await res.json();
      setStory(data);
    } catch (err) {
      console.error('[QbrStoryClient] Regenerate error:', err);
      setError('Failed to regenerate QBR story');
    } finally {
      setGenerating(false);
    }
  }, [companyId, quarter, story]);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-slate-800 rounded animate-pulse" />
          <div className="h-8 w-32 bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="grid h-[calc(100vh-200px)] grid-cols-[240px,1fr] gap-4">
          <div className="h-full bg-slate-800 rounded animate-pulse" />
          <div className="h-full bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-3 py-1.5 text-sm border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No story exists - show generate prompt
  if (!story) {
    return (
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">QBR Story - {quarter}</h1>
            <p className="text-xs text-slate-400 mt-1">
              AI-generated quarterly business review narrative
            </p>
          </div>
          <QuarterSelector companyId={companyId} selectedQuarter={quarter} />
        </div>

        <div className="p-8 bg-slate-900 border border-slate-800 rounded-lg flex flex-col items-center justify-center min-h-[400px]">
          <div className="p-4 rounded-full bg-slate-800 mb-4">
            <BookOpen className="h-8 w-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-200 mb-2">
            No QBR Story for {quarter}
          </h2>
          <p className="text-sm text-slate-400 mb-6 text-center max-w-md">
            Generate an AI-powered quarterly business review that synthesizes your
            strategic map, context graph, insights, KPIs, and work items into a
            coherent narrative.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate QBR Story
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Story exists - show full view
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-100">QBR Story - {quarter}</h1>
          <p className="text-xs text-slate-400">
            Generated {new Date(story.meta.generatedAt).toLocaleDateString()}
            {' '}·{' '}
            <span className={story.meta.status === 'finalized' ? 'text-emerald-400' : 'text-amber-400'}>
              {story.meta.status === 'finalized' ? 'Finalized' : 'Draft'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <QuarterSelector companyId={companyId} selectedQuarter={quarter} />
          <RegenerationControls
            onRegenerate={handleRegenerate}
            disabled={generating}
          />
        </div>
      </div>

      {/* Data Confidence Widget - from BrainSummary */}
      {brainSummary && (
        <DataConfidenceWidget brainSummary={brainSummary} companyId={companyId} />
      )}

      {/* Generating overlay */}
      {generating && (
        <div className="fixed inset-0 bg-slate-950/50 flex items-center justify-center z-50">
          <div className="p-6 bg-slate-900 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
              <p className="text-sm text-slate-200">Regenerating story...</p>
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="grid h-[calc(100vh-200px)] grid-cols-[240px,1fr,280px] gap-4">
        {/* Left sidebar - Chapter navigation */}
        <StoryChapterNav story={story} />

        {/* Main content - Story blocks */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Global summary section */}
          <div id="global-summary" className="p-4 bg-slate-900 border border-slate-800 border-dashed rounded-lg">
            <StoryBlockRenderer blocks={story.globalBlocks} />
          </div>

          {/* Context & Assumptions chapter - from BrainSummary */}
          {brainSummary && (
            <section id="chapter-context" className="scroll-mt-24">
              <ContextAssumptionsChapter
                brainSummary={brainSummary}
                companyId={companyId}
              />
            </section>
          )}

          {/* Domain chapters */}
          {story.chapters.map((chapter) => {
            const labId = DOMAIN_TO_LAB[chapter.domain];
            return (
              <section
                key={chapter.id}
                id={`chapter-${chapter.domain}`}
                className="scroll-mt-24"
              >
                <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  {/* Chapter header */}
                  <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-800/30">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-200">
                          {chapter.title}
                        </h2>
                        {/* Lab status badge */}
                        {brainSummary && labId && (
                          <ChapterLabBadge
                            labId={labId}
                            labs={brainSummary.labs}
                            companyId={companyId}
                          />
                        )}
                      </div>
                      {chapter.scoreDelta && (
                        <p className="text-[10px] text-slate-400">
                          Score: {chapter.scoreDelta.before} → {chapter.scoreDelta.after}
                          {' '}
                          <span className={chapter.scoreDelta.change >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            ({chapter.scoreDelta.change >= 0 ? '+' : ''}{chapter.scoreDelta.change})
                          </span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Deep link to Competition Lab for competitive chapters */}
                      {chapter.domain === 'competitive' && (
                        <Link
                          href={`/c/${companyId}/brain/labs/competition?from=qbr`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-md transition-colors"
                        >
                          <Swords className="w-3 h-3" />
                          Open Competition Lab
                        </Link>
                      )}
                      <RegenerationControls
                        domain={chapter.domain}
                        compact
                        onRegenerate={handleRegenerate}
                        disabled={generating}
                      />
                    </div>
                  </div>

                  {/* Chapter content */}
                  <div className="p-4 space-y-4">
                    <StoryBlockRenderer blocks={chapter.blocks} />
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Right sidebar - Highlights */}
        <div className="flex flex-col gap-4 overflow-y-auto pl-2">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
            <p className="text-xs font-semibold text-slate-300 mb-2">Quarter Highlights</p>
            <p className="text-xs text-slate-500">
              Key wins, risks, and KPI trends from this quarter's data.
            </p>
          </div>

          {/* Quick stats */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
            <p className="text-xs font-semibold text-slate-300 mb-2">Story Stats</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Chapters</span>
                <span className="text-slate-300">{story.chapters.length}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Global Blocks</span>
                <span className="text-slate-300">{story.globalBlocks.length}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Regenerations</span>
                <span className="text-slate-300">{story.meta.regenerationHistory.length}</span>
              </div>
            </div>
          </div>

          {/* Regeneration history */}
          {story.meta.regenerationHistory.length > 0 && (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
              <p className="text-xs font-semibold text-slate-300 mb-2">Recent Changes</p>
              <ul className="space-y-1 text-xs text-slate-400">
                {story.meta.regenerationHistory.slice(-3).reverse().map((entry) => (
                  <li key={entry.id}>
                    {entry.mode.replace('_', ' ')}
                    {entry.domain && entry.domain !== 'all' && ` (${entry.domain})`}
                    <span className="text-slate-500">
                      {' '}· {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
