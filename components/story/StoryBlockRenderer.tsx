'use client';

// components/story/StoryBlockRenderer.tsx
// Renders different types of story blocks for the cinematic QBR

import { forwardRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  CheckSquare,
  Lightbulb,
  Target,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Quote,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { HealthScoreRing } from '@/components/qbr/HealthScoreRing';
import { GoogleDriveAsset } from '@/components/media/GoogleDriveAsset';
import type {
  StoryBlock,
  HeroBlockContent,
  SectionHeaderContent,
  ProseContent,
  StatGridContent,
  SideBySideContent,
  PullQuoteContent,
  TrendCardContent,
  RecommendationListContent,
  ThemeCardContent,
  MetricHighlightContent,
  ChapterDividerContent,
  MediaBlockContent,
} from './types';

interface StoryBlockRendererProps {
  block: StoryBlock;
}

const iconMap: Record<string, React.ReactNode> = {
  Activity: <Activity className="w-6 h-6" />,
  CheckSquare: <CheckSquare className="w-6 h-6" />,
  Lightbulb: <Lightbulb className="w-6 h-6" />,
  Target: <Target className="w-6 h-6" />,
  Calendar: <Calendar className="w-6 h-6" />,
  FileText: <FileText className="w-6 h-6" />,
};

// Hero Block
function HeroBlock({ content }: { content: HeroBlockContent }) {
  return (
    <div className="relative min-h-[60vh] flex items-center justify-center py-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        {/* Company name */}
        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
          {content.companyName}
        </p>

        {/* Health score ring */}
        <div className="flex justify-center mb-8">
          <HealthScoreRing score={content.healthScore} size="xl" showLabel />
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-100 mb-4">
          {content.title}
        </h1>

        {/* Subtitle */}
        <p className="text-xl text-slate-400 mb-8">
          {content.subtitle}
        </p>

        {/* Quarter badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-slate-300">{content.quarterLabel}</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-slate-600 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-slate-400 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Section Header
function SectionHeader({ content }: { content: SectionHeaderContent }) {
  const icon = content.icon ? iconMap[content.icon] : null;

  return (
    <div className="py-16 border-b border-slate-800">
      <div className="flex items-center gap-4 mb-4">
        {icon && (
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-3xl font-bold text-slate-100">{content.title}</h2>
          {content.subtitle && (
            <p className="text-slate-400 mt-1">{content.subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Prose Block
function ProseBlock({ content }: { content: ProseContent }) {
  const toneStyles = {
    neutral: 'prose-slate',
    positive: 'prose-emerald',
    warning: 'prose-amber',
    critical: 'prose-red',
  };

  return (
    <div className={`py-8 prose prose-lg prose-invert max-w-none ${toneStyles[content.tone || 'neutral']}`}>
      <ReactMarkdown
        components={{
          strong: ({ children }) => (
            <strong className="text-slate-100 font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-slate-300 not-italic">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="space-y-2 my-4">{children}</ul>
          ),
          li: ({ children }) => (
            <li className="text-slate-300 flex items-start gap-2">
              <span className="text-blue-400 mt-1.5">•</span>
              <span>{children}</span>
            </li>
          ),
        }}
      >
        {content.markdown}
      </ReactMarkdown>
    </div>
  );
}

// Stat Grid
function StatGrid({ content }: { content: StatGridContent }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-8">
      {content.stats.map((stat, idx) => (
        <div key={idx} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">{stat.label}</p>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-slate-100">{stat.value}</span>
            {stat.change !== undefined && (
              <span
                className={`text-sm flex items-center gap-1 ${
                  stat.trend === 'up'
                    ? 'text-emerald-400'
                    : stat.trend === 'down'
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}
              >
                {stat.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                {stat.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                {stat.trend === 'flat' && <Minus className="w-3 h-3" />}
                {stat.change > 0 ? '+' : ''}{stat.change}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Side-by-Side
function SideBySide({ content }: { content: SideBySideContent }) {
  const toneColors = {
    positive: 'border-emerald-500/30 bg-emerald-500/5',
    negative: 'border-red-500/30 bg-red-500/5',
    neutral: 'border-slate-700 bg-slate-800/30',
  };

  const titleColors = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-slate-300',
  };

  const iconColors = {
    positive: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    negative: <AlertTriangle className="w-5 h-5 text-red-400" />,
    neutral: <FileText className="w-5 h-5 text-slate-400" />,
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 py-8">
      {/* Left */}
      <div className={`p-6 rounded-xl border ${toneColors[content.left.tone || 'neutral']}`}>
        <div className="flex items-center gap-3 mb-4">
          {iconColors[content.left.tone || 'neutral']}
          <h3 className={`font-semibold ${titleColors[content.left.tone || 'neutral']}`}>
            {content.left.title}
          </h3>
        </div>
        <ul className="space-y-2">
          {content.left.items.map((item, idx) => (
            <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
              <span className="text-slate-500 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Right */}
      <div className={`p-6 rounded-xl border ${toneColors[content.right.tone || 'neutral']}`}>
        <div className="flex items-center gap-3 mb-4">
          {iconColors[content.right.tone || 'neutral']}
          <h3 className={`font-semibold ${titleColors[content.right.tone || 'neutral']}`}>
            {content.right.title}
          </h3>
        </div>
        <ul className="space-y-2">
          {content.right.items.map((item, idx) => (
            <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
              <span className="text-slate-500 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Pull Quote
function PullQuote({ content }: { content: PullQuoteContent }) {
  const toneStyles = {
    insight: 'border-l-blue-400 bg-blue-500/5',
    warning: 'border-l-amber-400 bg-amber-500/5',
    success: 'border-l-emerald-400 bg-emerald-500/5',
  };

  return (
    <blockquote
      className={`py-8 my-8 pl-6 pr-4 border-l-4 rounded-r-xl ${
        toneStyles[content.tone || 'insight']
      }`}
    >
      <div className="flex gap-4">
        <Quote className="w-8 h-8 text-slate-600 flex-shrink-0" />
        <div>
          <p className="text-xl text-slate-200 italic leading-relaxed">{content.quote}</p>
          {content.attribution && (
            <p className="mt-3 text-sm text-slate-400">— {content.attribution}</p>
          )}
        </div>
      </div>
    </blockquote>
  );
}

// Trend Card
function TrendCard({ content }: { content: TrendCardContent }) {
  const trendColors = {
    up: 'text-emerald-400 bg-emerald-500/10',
    down: 'text-red-400 bg-red-500/10',
    flat: 'text-slate-400 bg-slate-500/10',
    new: 'text-blue-400 bg-blue-500/10',
  };

  const trendIcons = {
    up: <TrendingUp className="w-5 h-5" />,
    down: <TrendingDown className="w-5 h-5" />,
    flat: <Minus className="w-5 h-5" />,
    new: <Activity className="w-5 h-5" />,
  };

  return (
    <div className="p-5 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-slate-300">{content.label}</p>
        <span className={`p-1.5 rounded-lg ${trendColors[content.trend]}`}>
          {trendIcons[content.trend]}
        </span>
      </div>

      <div className="flex items-end gap-3 mb-2">
        {content.previousValue !== undefined && (
          <>
            <span className="text-lg text-slate-500">{content.previousValue}</span>
            <ArrowRight className="w-4 h-4 text-slate-600 mb-1" />
          </>
        )}
        <span className="text-3xl font-bold text-slate-100">{content.currentValue}</span>
        {content.delta !== undefined && (
          <span
            className={`text-sm mb-1 ${
              content.trend === 'up'
                ? 'text-emerald-400'
                : content.trend === 'down'
                ? 'text-red-400'
                : 'text-slate-400'
            }`}
          >
            ({content.delta > 0 ? '+' : ''}{content.delta})
          </span>
        )}
      </div>

      {content.narrative && (
        <p className="text-xs text-slate-500">{content.narrative}</p>
      )}
    </div>
  );
}

// Recommendation List
function RecommendationList({ content }: { content: RecommendationListContent }) {
  const tierStyles = {
    immediate: 'border-l-red-400',
    'short-term': 'border-l-amber-400',
    'mid-term': 'border-l-blue-400',
  };

  const tierBadgeStyles = {
    immediate: 'bg-red-500/20 text-red-400',
    'short-term': 'bg-amber-500/20 text-amber-400',
    'mid-term': 'bg-blue-500/20 text-blue-400',
  };

  return (
    <div className={`p-5 rounded-xl bg-slate-800/30 border-l-4 ${tierStyles[content.tier || 'mid-term']}`}>
      <div className="flex items-center gap-3 mb-4">
        <h4 className="font-semibold text-slate-200">{content.title}</h4>
        {content.tier && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierBadgeStyles[content.tier]}`}>
            {content.tier}
          </span>
        )}
      </div>
      <ul className="space-y-3">
        {content.items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400">
              {idx + 1}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Theme Card
function ThemeCard({ content }: { content: ThemeCardContent }) {
  const severityColors = {
    critical: 'border-red-500/30 bg-red-500/5',
    high: 'border-amber-500/30 bg-amber-500/5',
    medium: 'border-blue-500/30 bg-blue-500/5',
    low: 'border-slate-500/30 bg-slate-500/5',
  };

  const severityBadge = {
    critical: 'bg-red-500/20 text-red-400',
    high: 'bg-amber-500/20 text-amber-400',
    medium: 'bg-blue-500/20 text-blue-400',
    low: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <div className={`p-5 rounded-xl border ${severityColors[content.severity]}`}>
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold text-slate-200">{content.theme}</h4>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityBadge[content.severity]}`}>
          {content.findingsCount} findings
        </span>
      </div>

      <p className="text-sm text-slate-400 mb-4">{content.summary}</p>

      {content.recommendations.length > 0 && (
        <div className="border-t border-slate-700/50 pt-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Recommendations
          </p>
          <ul className="space-y-1.5">
            {content.recommendations.map((rec, idx) => (
              <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                <ArrowRight className="w-3 h-3 text-slate-600 mt-0.5 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Metric Highlight
function MetricHighlight({ content }: { content: MetricHighlightContent }) {
  const icon = content.icon ? iconMap[content.icon] : null;

  return (
    <div className="flex items-center gap-6 p-6 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-800/30 border border-slate-700/50">
      {icon && (
        <div className="p-4 rounded-xl bg-blue-500/10 text-blue-400 flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm text-slate-400">{content.metric}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-3xl font-bold text-slate-100">{content.value}</span>
          {content.trend && (
            <span
              className={`flex items-center gap-1 text-sm ${
                content.trend === 'up'
                  ? 'text-emerald-400'
                  : content.trend === 'down'
                  ? 'text-red-400'
                  : 'text-slate-400'
              }`}
            >
              {content.trend === 'up' && <TrendingUp className="w-4 h-4" />}
              {content.trend === 'down' && <TrendingDown className="w-4 h-4" />}
              {content.trend === 'flat' && <Minus className="w-4 h-4" />}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">{content.context}</p>
      </div>
    </div>
  );
}

// Chapter Divider
function ChapterDivider({ content }: { content: ChapterDividerContent }) {
  return (
    <div className="py-16 flex flex-col items-center text-center">
      <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-slate-600 to-transparent mb-8" />
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Next</p>
      <p className="text-xl font-semibold text-slate-300">{content.nextChapter}</p>
      {content.teaser && (
        <p className="text-sm text-slate-500 mt-2 max-w-md">{content.teaser}</p>
      )}
      <div className="mt-8 animate-bounce">
        <ArrowRight className="w-5 h-5 text-slate-500 rotate-90" />
      </div>
    </div>
  );
}

// Media Block
function MediaBlock({ content }: { content: MediaBlockContent }) {
  const alignClasses = {
    left: 'items-start',
    center: 'items-center',
    right: 'items-end',
    'full-width': 'items-center w-full',
  };

  const containerClasses = {
    left: 'max-w-2xl',
    center: 'max-w-4xl mx-auto',
    right: 'max-w-2xl ml-auto',
    'full-width': 'w-full',
  };

  const align = content.align || 'center';

  return (
    <div className={`py-8 flex flex-col ${alignClasses[align]}`}>
      <div className={`w-full ${containerClasses[align]}`}>
        <GoogleDriveAsset
          driveUrl={content.driveUrl}
          filename={content.filename}
          alt={content.alt || 'Media asset'}
          maxWidth={content.maxWidth}
          maxHeight={content.maxHeight}
          autoplay={content.autoplay}
          loop={content.loop}
          className="w-full"
        />
        {content.caption && (
          <p className="mt-4 text-sm text-slate-400 text-center italic">{content.caption}</p>
        )}
      </div>
    </div>
  );
}

// Main Block Renderer
export const StoryBlockRenderer = forwardRef<HTMLDivElement, StoryBlockRendererProps>(
  function StoryBlockRenderer({ block }, ref) {
    const content = block.content;

    return (
      <div ref={ref} id={block.id} data-chapter={block.chapterId}>
        {content.type === 'hero' && <HeroBlock content={content} />}
        {content.type === 'section-header' && <SectionHeader content={content} />}
        {content.type === 'prose' && <ProseBlock content={content} />}
        {content.type === 'stat-grid' && <StatGrid content={content} />}
        {content.type === 'side-by-side' && <SideBySide content={content} />}
        {content.type === 'pull-quote' && <PullQuote content={content} />}
        {content.type === 'trend-card' && <TrendCard content={content} />}
        {content.type === 'recommendation-list' && <RecommendationList content={content} />}
        {content.type === 'theme-card' && <ThemeCard content={content} />}
        {content.type === 'metric-highlight' && <MetricHighlight content={content} />}
        {content.type === 'chapter-divider' && <ChapterDivider content={content} />}
        {content.type === 'media' && <MediaBlock content={content} />}
      </div>
    );
  }
);
