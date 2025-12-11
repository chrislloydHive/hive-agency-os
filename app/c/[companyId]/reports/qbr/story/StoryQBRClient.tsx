'use client';

// app/c/[companyId]/reports/qbr/story/StoryQBRClient.tsx
// Cinematic Story QBR View with continuous scroll and left-anchored navigation

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Share2, Loader2, AlertTriangle } from 'lucide-react';
import {
  StoryNav,
  StoryNavMobile,
  StoryBlockRenderer,
  narrativeToStoryDocument,
  type StoryDocument,
  type StoryChapter,
} from '@/components/story';
import type { QBRNarrative } from '@/lib/os/reports/qbrNarrativeEngine';

interface StoryQBRClientProps {
  companyId: string;
  companyName: string;
}

export default function StoryQBRClient({ companyId, companyName }: StoryQBRClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storyDoc, setStoryDoc] = useState<StoryDocument | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string>('overview');
  const containerRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Load QBR data and generate story document
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/os/companies/${companyId}/qbr?narrative=true`);
        if (!response.ok) {
          throw new Error('Failed to load QBR data');
        }

        const result = await response.json();
        if (!result.success || !result.narrative) {
          throw new Error('No narrative data available');
        }

        // Transform narrative to story document
        const doc = narrativeToStoryDocument(result.narrative as QBRNarrative, companyId);
        setStoryDoc(doc);
      } catch (err) {
        console.error('[StoryQBR] Load error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load QBR');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [companyId]);

  // Scroll-spy: track active chapter based on scroll position
  useEffect(() => {
    if (!storyDoc) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry that is most visible
        let maxRatio = 0;
        let activeId = activeChapterId;

        for (const entry of entries) {
          const chapterId = entry.target.getAttribute('data-chapter');
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio && chapterId) {
            maxRatio = entry.intersectionRatio;
            activeId = chapterId;
          }
        }

        if (activeId !== activeChapterId) {
          setActiveChapterId(activeId);
        }
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '-20% 0px -60% 0px',
      }
    );

    // Observe all blocks
    const blocks = containerRef.current?.querySelectorAll('[data-chapter]');
    blocks?.forEach((block) => observer.observe(block));

    return () => observer.disconnect();
  }, [storyDoc, activeChapterId]);

  // Handle chapter click - scroll to chapter
  const handleChapterClick = useCallback((chapterId: string) => {
    // Find first block of this chapter
    const block = containerRef.current?.querySelector(`[data-chapter="${chapterId}"]`);
    if (block) {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveChapterId(chapterId);
    }
  }, []);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!storyDoc) return;

    try {
      // Generate markdown from narrative
      const response = await fetch(`/api/os/companies/${companyId}/qbr?narrative=true`);
      const result = await response.json();

      if (result.narrative?.fullNarrativeText) {
        const blob = new Blob([result.narrative.fullNarrativeText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${storyDoc.meta.companyName.replace(/\s+/g, '-')}-${storyDoc.meta.quarterLabel.replace(/\s+/g, '-')}-QBR.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[StoryQBR] Export error:', err);
    }
  }, [companyId, storyDoc]);

  // Handle share
  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({
        title: `${companyName} QBR`,
        text: `${storyDoc?.meta.quarterLabel} Business Review for ${companyName}`,
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      // Could show a toast here
    }
  }, [companyName, storyDoc]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your QBR story...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="p-4 rounded-full bg-red-500/10 w-fit mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Unable to Load QBR</h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/c/${companyId}/reports/qbr`)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            Back to QBR
          </button>
        </div>
      </div>
    );
  }

  if (!storyDoc) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push(`/c/${companyId}/reports/qbr`)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to QBR</span>
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      </header>

      {/* Left navigation */}
      <StoryNav
        chapters={storyDoc.chapters}
        activeChapterId={activeChapterId}
        onChapterClick={handleChapterClick}
      />

      {/* Main content */}
      <main ref={containerRef} className="max-w-4xl mx-auto px-6 pt-14 pb-24 lg:pl-48">
        {storyDoc.blocks.map((block) => (
          <StoryBlockRenderer key={block.id} block={block} />
        ))}

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Generated by Hive OS • {new Date(storyDoc.meta.generatedAt).toLocaleDateString()}
          </p>
        </footer>
      </main>

      {/* Mobile navigation */}
      <StoryNavMobile
        chapters={storyDoc.chapters}
        activeChapterId={activeChapterId}
        onChapterClick={handleChapterClick}
      />
    </div>
  );
}
