// lib/os/analytics/pulseUtils.ts
// Utility functions for Performance Pulse display
// This file is safe to import in client components

/**
 * Format a percent change for display
 */
export function formatPercentChange(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '0%';
  return value > 0 ? `+${value}%` : `${value}%`;
}

/**
 * Get the color class for a percent change
 */
export function getChangeColorClass(value: number | null): string {
  if (value === null || value === 0) return 'text-slate-400';
  return value > 0 ? 'text-emerald-400' : 'text-red-400';
}

/**
 * Get the arrow direction for a change
 */
export function getChangeArrow(value: number | null): '▲' | '▼' | '—' {
  if (value === null || value === 0) return '—';
  return value > 0 ? '▲' : '▼';
}
