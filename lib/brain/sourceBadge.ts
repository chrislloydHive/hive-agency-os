// lib/brain/sourceBadge.ts
// Client-safe utility functions for source badges
// These are extracted from companyContext.ts to avoid bundling server-only code

export type SourceType = 'brain' | 'diagnostics' | 'profile' | 'manual';

/**
 * Get a human-readable label for a source
 */
export function getSourceLabel(source: SourceType): string {
  switch (source) {
    case 'brain':
      return 'From Brain';
    case 'diagnostics':
      return 'From Diagnostics';
    case 'profile':
      return 'From Profile';
    case 'manual':
      return 'Manual Entry';
    default:
      return 'Unknown';
  }
}

/**
 * Get badge color for a source
 */
export function getSourceBadgeColor(source: SourceType): {
  text: string;
  bg: string;
  border: string;
} {
  switch (source) {
    case 'brain':
      return {
        text: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/30',
      };
    case 'diagnostics':
      return {
        text: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
      };
    case 'profile':
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
      };
    case 'manual':
      return {
        text: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
      };
    default:
      return {
        text: 'text-slate-400',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
      };
  }
}
