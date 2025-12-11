'use client';

// components/story/StoryNav.tsx
// Left-anchored navigation for Story QBR with scroll-spy

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Activity,
  CheckSquare,
  Lightbulb,
  Target,
  Calendar,
  ChevronUp,
} from 'lucide-react';
import type { StoryChapter } from './types';

interface StoryNavProps {
  chapters: StoryChapter[];
  activeChapterId: string;
  onChapterClick: (chapterId: string) => void;
}

const iconMap: Record<string, React.ReactNode> = {
  overview: <FileText className="w-4 h-4" />,
  health: <Activity className="w-4 h-4" />,
  work: <CheckSquare className="w-4 h-4" />,
  insights: <Lightbulb className="w-4 h-4" />,
  recommendations: <Target className="w-4 h-4" />,
  outlook: <Calendar className="w-4 h-4" />,
};

export function StoryNav({ chapters, activeChapterId, onChapterClick }: StoryNavProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track scroll position for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);

  return (
    <nav className="fixed left-4 top-1/2 -translate-y-1/2 z-40 hidden lg:block">
      <div className="bg-slate-900/90 backdrop-blur-lg border border-slate-700/50 rounded-xl p-2 shadow-xl">
        {/* Toggle button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-slate-200 transition-colors mb-1"
          aria-label={isExpanded ? 'Collapse navigation' : 'Expand navigation'}
        >
          <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronUp className="w-4 h-4 rotate-90" />
          </div>
        </button>

        {/* Chapter list */}
        <ul className="space-y-1">
          {sortedChapters.map((chapter) => {
            const isActive = chapter.id === activeChapterId;
            const icon = iconMap[chapter.id] || <FileText className="w-4 h-4" />;

            return (
              <li key={chapter.id}>
                <button
                  onClick={() => onChapterClick(chapter.id)}
                  className={`
                    flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-blue-500/20 text-blue-400 border-l-2 border-blue-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }
                  `}
                  title={chapter.title}
                >
                  <span className={`flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`}>
                    {icon}
                  </span>
                  {isExpanded && (
                    <span className="text-sm font-medium whitespace-nowrap">
                      {chapter.shortTitle}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Progress indicator */}
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2 px-2">
            <div className="flex gap-1">
              {sortedChapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className={`
                    w-2 h-2 rounded-full transition-colors
                    ${chapter.id === activeChapterId
                      ? 'bg-blue-400'
                      : sortedChapters.findIndex(c => c.id === chapter.id) <
                        sortedChapters.findIndex(c => c.id === activeChapterId)
                      ? 'bg-slate-500'
                      : 'bg-slate-700'
                    }
                  `}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Scroll to top */}
        {showScrollTop && (
          <button
            onClick={handleScrollToTop}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
            {isExpanded && 'Top'}
          </button>
        )}
      </div>
    </nav>
  );
}

/**
 * Mobile navigation bar (bottom)
 */
export function StoryNavMobile({ chapters, activeChapterId, onChapterClick }: StoryNavProps) {
  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
  const activeIndex = sortedChapters.findIndex(c => c.id === activeChapterId);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50 safe-area-inset-bottom">
      <div className="flex items-center justify-between px-2 py-2">
        {sortedChapters.map((chapter, index) => {
          const isActive = chapter.id === activeChapterId;
          const icon = iconMap[chapter.id] || <FileText className="w-4 h-4" />;
          const isPast = index < activeIndex;

          return (
            <button
              key={chapter.id}
              onClick={() => onChapterClick(chapter.id)}
              className={`
                flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all
                ${isActive
                  ? 'text-blue-400 bg-blue-500/10'
                  : isPast
                  ? 'text-slate-500'
                  : 'text-slate-400'
                }
              `}
            >
              {icon}
              <span className="text-[10px] font-medium">{chapter.shortTitle}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
