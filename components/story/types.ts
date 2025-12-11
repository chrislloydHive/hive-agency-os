// components/story/types.ts
// Shared types for Story QBR components

import type { QBRNarrative, QBRNarrativeSection } from '@/lib/os/reports/qbrNarrativeEngine';

/**
 * Story chapter for navigation
 */
export interface StoryChapter {
  id: string;
  title: string;
  shortTitle: string;
  icon?: string;
  order: number;
}

/**
 * Story block types for rendering
 */
export type StoryBlockType =
  | 'hero'
  | 'section-header'
  | 'prose'
  | 'stat-grid'
  | 'side-by-side'
  | 'pull-quote'
  | 'trend-card'
  | 'recommendation-list'
  | 'theme-card'
  | 'metric-highlight'
  | 'chapter-divider';

/**
 * A story block with content
 */
export interface StoryBlock {
  id: string;
  type: StoryBlockType;
  chapterId: string;
  order: number;
  content: StoryBlockContent;
}

/**
 * Story block content variants
 */
export type StoryBlockContent =
  | HeroBlockContent
  | SectionHeaderContent
  | ProseContent
  | StatGridContent
  | SideBySideContent
  | PullQuoteContent
  | TrendCardContent
  | RecommendationListContent
  | ThemeCardContent
  | MetricHighlightContent
  | ChapterDividerContent;

export interface HeroBlockContent {
  type: 'hero';
  title: string;
  subtitle: string;
  healthScore: number;
  quarterLabel: string;
  companyName: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface SectionHeaderContent {
  type: 'section-header';
  title: string;
  subtitle?: string;
  icon?: string;
}

export interface ProseContent {
  type: 'prose';
  markdown: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
}

export interface StatGridContent {
  type: 'stat-grid';
  stats: {
    label: string;
    value: string | number;
    change?: number;
    trend?: 'up' | 'down' | 'flat';
  }[];
}

export interface SideBySideContent {
  type: 'side-by-side';
  left: {
    title: string;
    items: string[];
    tone?: 'positive' | 'negative' | 'neutral';
  };
  right: {
    title: string;
    items: string[];
    tone?: 'positive' | 'negative' | 'neutral';
  };
}

export interface PullQuoteContent {
  type: 'pull-quote';
  quote: string;
  attribution?: string;
  tone?: 'insight' | 'warning' | 'success';
}

export interface TrendCardContent {
  type: 'trend-card';
  label: string;
  currentValue: number | string;
  previousValue?: number | string;
  delta?: number;
  trend: 'up' | 'down' | 'flat' | 'new';
  narrative?: string;
}

export interface RecommendationListContent {
  type: 'recommendation-list';
  title: string;
  tier?: 'immediate' | 'short-term' | 'mid-term';
  items: string[];
}

export interface ThemeCardContent {
  type: 'theme-card';
  theme: string;
  summary: string;
  findingsCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendations: string[];
}

export interface MetricHighlightContent {
  type: 'metric-highlight';
  metric: string;
  value: string | number;
  context: string;
  icon?: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface ChapterDividerContent {
  type: 'chapter-divider';
  nextChapter: string;
  teaser?: string;
}

/**
 * Complete story structure
 */
export interface StoryDocument {
  chapters: StoryChapter[];
  blocks: StoryBlock[];
  meta: {
    companyId: string;
    companyName: string;
    quarterLabel: string;
    generatedAt: string;
    healthScore: number;
  };
}

/**
 * Props for story nav
 */
export interface StoryNavProps {
  chapters: StoryChapter[];
  activeChapterId: string;
  onChapterClick: (chapterId: string) => void;
}

/**
 * Transform QBR narrative to story document
 */
export function narrativeToStoryDocument(
  narrative: QBRNarrative,
  companyId: string
): StoryDocument {
  const chapters: StoryChapter[] = [
    { id: 'overview', title: 'Executive Overview', shortTitle: 'Overview', order: 0 },
    { id: 'health', title: 'Marketing Health', shortTitle: 'Health', order: 1 },
    { id: 'work', title: 'Work & Progress', shortTitle: 'Work', order: 2 },
    { id: 'insights', title: 'Key Insights', shortTitle: 'Insights', order: 3 },
    { id: 'recommendations', title: 'Recommendations', shortTitle: 'Actions', order: 4 },
    { id: 'outlook', title: 'Next Quarter', shortTitle: 'Outlook', order: 5 },
  ];

  const blocks: StoryBlock[] = [];
  let order = 0;

  // Hero block
  blocks.push({
    id: 'hero',
    type: 'hero',
    chapterId: 'overview',
    order: order++,
    content: {
      type: 'hero',
      title: `${narrative.quarterLabel} Business Review`,
      subtitle: `Marketing Performance & Strategic Outlook`,
      healthScore: narrative.healthScore,
      quarterLabel: narrative.quarterLabel,
      companyName: narrative.companyName,
    },
  });

  // Executive summary prose
  blocks.push({
    id: 'exec-summary',
    type: 'prose',
    chapterId: 'overview',
    order: order++,
    content: {
      type: 'prose',
      markdown: narrative.executiveSummary.content,
      tone: narrative.executiveSummary.tone,
    },
  });

  // Wins and Challenges side-by-side
  if (narrative.keyWins.bullets?.length || narrative.keyChallenges.bullets?.length) {
    blocks.push({
      id: 'wins-challenges',
      type: 'side-by-side',
      chapterId: 'overview',
      order: order++,
      content: {
        type: 'side-by-side',
        left: {
          title: 'Key Wins',
          items: narrative.keyWins.bullets || [],
          tone: 'positive',
        },
        right: {
          title: 'Challenges',
          items: narrative.keyChallenges.bullets || [],
          tone: 'negative',
        },
      },
    });
  }

  // Chapter divider
  blocks.push({
    id: 'divider-health',
    type: 'chapter-divider',
    chapterId: 'overview',
    order: order++,
    content: {
      type: 'chapter-divider',
      nextChapter: 'Marketing Health',
      teaser: 'Deep dive into diagnostic performance and trends',
    },
  });

  // Health section header
  blocks.push({
    id: 'health-header',
    type: 'section-header',
    chapterId: 'health',
    order: order++,
    content: {
      type: 'section-header',
      title: 'Marketing Health',
      subtitle: 'Diagnostic performance and trend analysis',
      icon: 'Activity',
    },
  });

  // Health prose
  blocks.push({
    id: 'health-prose',
    type: 'prose',
    chapterId: 'health',
    order: order++,
    content: {
      type: 'prose',
      markdown: narrative.diagnosticsSection.content,
      tone: narrative.diagnosticsSection.tone,
    },
  });

  // Diagnostic trends
  if (narrative.diagnosticTrends.length > 0) {
    for (const trend of narrative.diagnosticTrends.slice(0, 4)) {
      blocks.push({
        id: `trend-${trend.toolId}`,
        type: 'trend-card',
        chapterId: 'health',
        order: order++,
        content: {
          type: 'trend-card',
          label: trend.label,
          currentValue: trend.currentScore ?? 'N/A',
          previousValue: trend.previousScore ?? undefined,
          delta: trend.delta ?? undefined,
          trend: trend.trend,
        },
      });
    }
  }

  // Work section
  blocks.push({
    id: 'work-header',
    type: 'section-header',
    chapterId: 'work',
    order: order++,
    content: {
      type: 'section-header',
      title: 'Work & Progress',
      subtitle: 'Execution status and accomplishments',
      icon: 'CheckSquare',
    },
  });

  blocks.push({
    id: 'work-prose',
    type: 'prose',
    chapterId: 'work',
    order: order++,
    content: {
      type: 'prose',
      markdown: narrative.workSection.content,
      tone: narrative.workSection.tone,
    },
  });

  // Insights section
  blocks.push({
    id: 'insights-header',
    type: 'section-header',
    chapterId: 'insights',
    order: order++,
    content: {
      type: 'section-header',
      title: 'Key Insights',
      subtitle: 'Strategic findings and analysis',
      icon: 'Lightbulb',
    },
  });

  blocks.push({
    id: 'insights-prose',
    type: 'prose',
    chapterId: 'insights',
    order: order++,
    content: {
      type: 'prose',
      markdown: narrative.findingsSection.content,
      tone: narrative.findingsSection.tone,
    },
  });

  // Theme deep dives
  if (narrative.themeDeepDives.length > 0) {
    for (const theme of narrative.themeDeepDives.slice(0, 3)) {
      blocks.push({
        id: `theme-${theme.theme}`,
        type: 'theme-card',
        chapterId: 'insights',
        order: order++,
        content: {
          type: 'theme-card',
          theme: theme.theme,
          summary: theme.summary,
          findingsCount: theme.findings.length,
          severity: theme.findings[0]?.severity || 'medium',
          recommendations: theme.recommendations.slice(0, 3),
        },
      });
    }
  }

  // Recommendations section
  blocks.push({
    id: 'recommendations-header',
    type: 'section-header',
    chapterId: 'recommendations',
    order: order++,
    content: {
      type: 'section-header',
      title: 'Recommendations',
      subtitle: 'Prioritized actions for improvement',
      icon: 'Target',
    },
  });

  blocks.push({
    id: 'recommendations-prose',
    type: 'prose',
    chapterId: 'recommendations',
    order: order++,
    content: {
      type: 'prose',
      markdown: narrative.recommendationsSection.content,
      tone: narrative.recommendationsSection.tone,
    },
  });

  // Sequenced recommendations
  if (narrative.sequencedRecommendations.length > 0) {
    for (const tier of narrative.sequencedRecommendations) {
      blocks.push({
        id: `rec-${tier.tier}`,
        type: 'recommendation-list',
        chapterId: 'recommendations',
        order: order++,
        content: {
          type: 'recommendation-list',
          title: tier.tierLabel,
          tier: tier.tier,
          items: tier.recommendations,
        },
      });
    }
  }

  // Outlook section
  blocks.push({
    id: 'outlook-header',
    type: 'section-header',
    chapterId: 'outlook',
    order: order++,
    content: {
      type: 'section-header',
      title: 'Next Quarter Focus',
      subtitle: 'Looking ahead and planning for success',
      icon: 'Calendar',
    },
  });

  blocks.push({
    id: 'outlook-prose',
    type: 'prose',
    chapterId: 'outlook',
    order: order++,
    content: {
      type: 'prose',
      markdown: narrative.nextQuarterFocus.content,
      tone: narrative.nextQuarterFocus.tone,
    },
  });

  return {
    chapters,
    blocks,
    meta: {
      companyId,
      companyName: narrative.companyName,
      quarterLabel: narrative.quarterLabel,
      generatedAt: new Date().toISOString(),
      healthScore: narrative.healthScore,
    },
  };
}
