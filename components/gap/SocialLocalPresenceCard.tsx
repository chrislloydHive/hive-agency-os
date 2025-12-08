// components/gap/SocialLocalPresenceCard.tsx
//
// Social & Local Presence Card for GAP Reports
//
// Displays:
// - socialLocalPresence score (0-100)
// - Social network status grid with confidence badges
// - GBP status with detection source transparency
// - Data confidence indicator
//
// Usage:
//   <SocialLocalPresenceCard
//     snapshot={run.socialFootprint}
//     score={run.socialLocalPresenceScore}
//   />

'use client';

import { useState } from 'react';
import type {
  SocialFootprintSnapshot,
  SocialPresence,
  GbpPresence,
  PresenceStatus,
  SocialNetwork,
  DetectionSource,
} from '@/lib/gap/socialDetection';

// ============================================================================
// Props
// ============================================================================

interface SocialLocalPresenceCardProps {
  /** The social footprint snapshot from detection */
  snapshot?: SocialFootprintSnapshot | null;
  /** Pre-computed socialLocalPresence score (0-100) */
  score?: number;
  /** Whether to show debug info (detection sources) */
  showDebug?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const NETWORK_LABELS: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
};

const NETWORK_ICONS: Record<SocialNetwork, React.ReactNode> = {
  instagram: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  facebook: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  tiktok: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  linkedin: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  youtube: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status badge styling
 */
function getStatusBadge(status: PresenceStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case 'present':
      return { bg: 'bg-green-900/30', text: 'text-green-400', label: 'Active' };
    case 'probable':
      return { bg: 'bg-cyan-900/30', text: 'text-cyan-400', label: 'Likely' };
    case 'inconclusive':
      return { bg: 'bg-amber-900/30', text: 'text-amber-400', label: 'Unclear' };
    case 'missing':
      return { bg: 'bg-slate-700', text: 'text-slate-400', label: 'Not Found' };
  }
}

/**
 * Get confidence color based on level
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-emerald-400';
  if (confidence >= 0.5) return 'text-cyan-400';
  if (confidence >= 0.3) return 'text-amber-400';
  return 'text-slate-500';
}

/**
 * Get data confidence badge styling
 */
function getDataConfidenceBadge(confidence: number): { bg: string; text: string; label: string } {
  if (confidence >= 0.7) {
    return { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'High' };
  }
  if (confidence >= 0.5) {
    return { bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400', label: 'Medium' };
  }
  return { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', label: 'Low' };
}

/**
 * Format detection source for display
 */
function formatDetectionSource(source: DetectionSource): string {
  const labels: Record<DetectionSource, string> = {
    html_link_header: 'Header Link',
    html_link_footer: 'Footer Link',
    html_link_body: 'Page Link',
    schema_sameAs: 'Schema sameAs',
    schema_url: 'Schema URL',
    schema_gbp: 'Schema hasMap',
    schema_social: 'Schema Social',
    search_fallback: 'Search Fallback',
    manual: 'Manual Entry',
  };
  return labels[source] || source;
}

/**
 * Generate bar visualization
 */
function generateBar(score: number): string {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

/**
 * Get score color
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

// ============================================================================
// Component
// ============================================================================

export function SocialLocalPresenceCard({
  snapshot,
  score = 0,
  showDebug = false,
}: SocialLocalPresenceCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Handle no data case
  if (!snapshot) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100">Social & Local Presence</h3>
          <span className="text-sm text-slate-500">No data available</span>
        </div>
        <p className="text-sm text-slate-400">
          Social media and Google Business Profile detection was not performed for this assessment.
        </p>
      </div>
    );
  }

  const { socials, gbp, dataConfidence } = snapshot;
  const dataBadge = getDataConfidenceBadge(dataConfidence);

  // Count active profiles
  const activeCount = socials.filter(
    s => s.status === 'present' || s.status === 'probable'
  ).length;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 space-y-4">
      {/* Header with Score and Data Confidence */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Social & Local Presence</h3>
          <p className="text-xs text-slate-500 mt-1">
            {activeCount} active social{activeCount !== 1 ? 's' : ''} detected
            {gbp && (gbp.status === 'present' || gbp.status === 'probable') && ' + GBP'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Data Confidence Badge */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded border ${dataBadge.bg}`}
            title={`Data confidence: ${Math.round(dataConfidence * 100)}%`}
          >
            <span className={`text-xs font-medium ${dataBadge.text}`}>
              {dataBadge.label}
            </span>
            <span className="text-xs text-slate-500">confidence</span>
          </div>

          {/* Score */}
          <div className={`text-2xl font-bold tabular-nums ${getScoreColor(score)}`}>
            {score}
            <span className="text-sm text-slate-400 font-normal">/100</span>
          </div>
        </div>
      </div>

      {/* Score Bar */}
      <div className="space-y-1">
        <div className="font-mono text-sm text-slate-400 tracking-wider">
          {generateBar(score)}
        </div>
      </div>

      {/* GBP Section */}
      {gbp && (
        <div className="border-t border-slate-700/50 pt-4">
          <div className="flex items-center justify-between p-3 rounded bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-200">Google Business Profile</span>
                {gbp.url && (
                  <a
                    href={gbp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-400 hover:underline truncate max-w-xs"
                  >
                    {gbp.url.length > 40 ? gbp.url.slice(0, 40) + '...' : gbp.url}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${getConfidenceColor(gbp.confidence)}`}>
                {Math.round(gbp.confidence * 100)}%
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${getStatusBadge(gbp.status).bg} ${getStatusBadge(gbp.status).text}`}
              >
                {getStatusBadge(gbp.status).label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Social Networks Grid */}
      <div className="border-t border-slate-700/50 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Social Profiles
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {socials.map((social) => {
            const badge = getStatusBadge(social.status);
            const isActive = social.status === 'present' || social.status === 'probable';

            return (
              <div
                key={social.network}
                className={`flex items-center justify-between p-2.5 rounded border ${
                  isActive
                    ? 'bg-slate-800/50 border-slate-700/50'
                    : 'bg-slate-900/30 border-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={isActive ? 'text-slate-300' : 'text-slate-600'}>
                    {NETWORK_ICONS[social.network]}
                  </span>
                  <div>
                    <span
                      className={`text-sm ${isActive ? 'text-slate-200' : 'text-slate-500'}`}
                    >
                      {NETWORK_LABELS[social.network]}
                    </span>
                    {social.handle && (
                      <span className="block text-xs text-slate-500 truncate max-w-[100px]">
                        @{social.handle}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isActive && (
                    <span className={`text-xs ${getConfidenceColor(social.confidence)}`}>
                      {Math.round(social.confidence * 100)}%
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Debug: Detection Sources */}
      {showDebug && (
        <div className="border-t border-slate-700/50 pt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1"
          >
            <span className={`transition-transform ${showDetails ? 'rotate-90' : ''}`}>
              {'\u25B6'}
            </span>
            Detection Sources
          </button>

          {showDetails && (
            <div className="mt-3 space-y-2 text-xs">
              {gbp && gbp.detectionSources.length > 0 && (
                <div className="p-2 bg-slate-800/30 rounded">
                  <span className="font-medium text-slate-400">GBP:</span>{' '}
                  <span className="text-slate-500">
                    {gbp.detectionSources.map(formatDetectionSource).join(', ')}
                  </span>
                </div>
              )}
              {socials
                .filter(s => s.detectionSources.length > 0)
                .map(social => (
                  <div key={social.network} className="p-2 bg-slate-800/30 rounded">
                    <span className="font-medium text-slate-400">
                      {NETWORK_LABELS[social.network]}:
                    </span>{' '}
                    <span className="text-slate-500">
                      {social.detectionSources.map(formatDetectionSource).join(', ')}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Callout for Low Confidence */}
      {dataConfidence < 0.5 && (
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-900/10 p-3 mt-4">
          <p className="text-xs text-amber-300">
            <span className="font-semibold">Limited detection confidence.</span>{' '}
            Social profiles may exist that weren't found on the website. Manual verification recommended.
          </p>
        </div>
      )}
    </div>
  );
}
