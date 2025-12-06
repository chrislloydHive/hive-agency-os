// components/qbr/StoryChapterNav.tsx
// Left sidebar navigation for QBR Story chapters

'use client';

import { BookOpen, Globe } from 'lucide-react';
import type { QbrStory, QbrDomain } from '@/lib/qbr/qbrTypes';

interface Props {
  story: QbrStory;
}

const DOMAIN_ICONS: Record<QbrDomain | 'global', React.ReactNode> = {
  global: <Globe className="h-4 w-4" />,
  strategy: <span className="text-xs">📊</span>,
  website: <span className="text-xs">🌐</span>,
  seo: <span className="text-xs">🔍</span>,
  content: <span className="text-xs">📝</span>,
  brand: <span className="text-xs">🎨</span>,
  audience: <span className="text-xs">👥</span>,
  media: <span className="text-xs">📢</span>,
  analytics: <span className="text-xs">📈</span>,
  competitive: <span className="text-xs">⚔️</span>,
};

export function StoryChapterNav({ story }: Props) {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="flex flex-col gap-1 bg-slate-900 border border-slate-800 rounded-lg p-3 overflow-y-auto">
      <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
        <BookOpen className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Chapters
        </span>
      </div>

      {/* Global Summary */}
      <button
        onClick={() => scrollToSection('global-summary')}
        className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
      >
        {DOMAIN_ICONS.global}
        <span>Executive Summary</span>
      </button>

      {/* Domain Chapters */}
      {story.chapters.map((chapter) => (
        <button
          key={chapter.id}
          onClick={() => scrollToSection(`chapter-${chapter.domain}`)}
          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors group"
        >
          <div className="flex items-center gap-2 min-w-0">
            {DOMAIN_ICONS[chapter.domain]}
            <span className="truncate">{chapter.title}</span>
          </div>
          {chapter.scoreDelta && (
            <span
              className={`text-[10px] flex-shrink-0 ${
                chapter.scoreDelta.change >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {chapter.scoreDelta.change >= 0 ? '+' : ''}
              {chapter.scoreDelta.change}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
