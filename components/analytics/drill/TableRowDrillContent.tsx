// components/analytics/drill/TableRowDrillContent.tsx
// Deep-dive content for table row modals
//
// Supports drill-through for:
// - Company rows (from workspace analytics)
// - Traffic source/medium rows
// - Landing page rows
// - Search query rows (with external Google search links)
// - Channel rows

'use client';

import { StatRow } from './AnalyticsDrillModal';
import { getGoogleSearchUrl } from '@/lib/analytics/searchLinks';

// ============================================================================
// Company Drill Content
// ============================================================================

interface CompanyDrillContentProps {
  companyName: string;
  companyId: string;
  metrics: {
    sessions?: number;
    users?: number;
    conversions?: number;
    dmaStarted?: number;
    dmaCompleted?: number;
    gapStarted?: number;
    gapComplete?: number;
    gapReviewCtaClicked?: number;
  };
  dateRange?: string;
}

export function CompanyDrillContent({
  companyName,
  metrics,
  dateRange = '30d',
}: CompanyDrillContentProps) {
  const dmaCompletionRate =
    metrics.dmaStarted && metrics.dmaStarted > 0
      ? (metrics.dmaCompleted || 0) / metrics.dmaStarted
      : 0;

  const gapCompletionRate =
    metrics.gapStarted && metrics.gapStarted > 0
      ? (metrics.gapComplete || 0) / metrics.gapStarted
      : 0;

  return (
    <div className="space-y-4">
      {/* Company header */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          {dateRange} Performance
        </div>
        <h3 className="text-lg font-semibold text-slate-100">{companyName}</h3>
      </div>

      {/* Traffic metrics */}
      {(metrics.sessions !== undefined || metrics.users !== undefined) && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
            Traffic Metrics
          </div>
          <div className="grid grid-cols-3 gap-4">
            {metrics.sessions !== undefined && (
              <div>
                <div className="text-2xl font-bold text-slate-100">
                  {metrics.sessions.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">Sessions</div>
              </div>
            )}
            {metrics.users !== undefined && (
              <div>
                <div className="text-2xl font-bold text-slate-100">
                  {metrics.users.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">Users</div>
              </div>
            )}
            {metrics.conversions !== undefined && (
              <div>
                <div className="text-2xl font-bold text-slate-100">
                  {metrics.conversions.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">Conversions</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Funnel metrics */}
      {(metrics.dmaStarted !== undefined || metrics.gapStarted !== undefined) && (
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
            Funnel Performance
          </div>
          <div className="space-y-0">
            {metrics.dmaStarted !== undefined && (
              <>
                <StatRow
                  label="DMA Started"
                  value={metrics.dmaStarted.toLocaleString()}
                />
                <StatRow
                  label="DMA Completed"
                  value={metrics.dmaCompleted?.toLocaleString() || '0'}
                  subValue={`${(dmaCompletionRate * 100).toFixed(1)}%`}
                />
              </>
            )}
            {metrics.gapStarted !== undefined && (
              <>
                <StatRow
                  label="Full GAP Started"
                  value={metrics.gapStarted.toLocaleString()}
                />
                <StatRow
                  label="Full GAP Complete"
                  value={metrics.gapComplete?.toLocaleString() || '0'}
                  subValue={`${(gapCompletionRate * 100).toFixed(1)}%`}
                />
                <StatRow
                  label="Review CTA Clicked"
                  value={metrics.gapReviewCtaClicked?.toLocaleString() || '0'}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Traffic Source Drill Content
// ============================================================================

interface TrafficSourceDrillContentProps {
  source: string;
  medium: string;
  metrics: {
    sessions: number;
    users: number;
    conversions: number;
    bounceRate: number;
  };
}

export function TrafficSourceDrillContent({
  source,
  medium,
  metrics,
}: TrafficSourceDrillContentProps) {
  const conversionRate =
    metrics.sessions > 0 ? (metrics.conversions / metrics.sessions) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Source header */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-500 uppercase tracking-wide">
            Traffic Source
          </span>
        </div>
        <div className="text-lg font-semibold text-slate-100">
          {source}
          <span className="text-slate-400 font-normal"> / {medium}</span>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">
            {metrics.sessions.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Sessions</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">
            {metrics.users.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Users</div>
        </div>
      </div>

      {/* Conversion metrics */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
          Performance
        </div>
        <div className="space-y-0">
          <StatRow label="Conversions" value={metrics.conversions.toLocaleString()} />
          <StatRow label="Conversion Rate" value={`${conversionRate.toFixed(2)}%`} />
          <StatRow
            label="Bounce Rate"
            value={`${(metrics.bounceRate * 100).toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Channel classification */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <svg
            className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-amber-100">
            {classifySourceMedium(source, medium)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Landing Page Drill Content
// ============================================================================

interface LandingPageDrillContentProps {
  path: string;
  fullUrl?: string;
  metrics: {
    pageviews: number;
    users: number;
    avgTimeOnPage: number;
    bounceRate: number;
    entrances?: number;
    exits?: number;
  };
}

export function LandingPageDrillContent({
  path,
  fullUrl,
  metrics,
}: LandingPageDrillContentProps) {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          Landing Page
        </div>
        <div className="font-mono text-sm text-slate-100 break-all">{path}</div>
        {fullUrl && (
          <div className="mt-2">
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              Open page
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">
            {metrics.pageviews.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Pageviews</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">
            {metrics.users.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Users</div>
        </div>
      </div>

      {/* Engagement metrics */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
          Engagement
        </div>
        <div className="space-y-0">
          <StatRow
            label="Avg Time on Page"
            value={formatDuration(metrics.avgTimeOnPage)}
          />
          <StatRow
            label="Bounce Rate"
            value={`${(metrics.bounceRate * 100).toFixed(1)}%`}
          />
          {metrics.entrances !== undefined && (
            <StatRow label="Entrances" value={metrics.entrances.toLocaleString()} />
          )}
          {metrics.exits !== undefined && (
            <StatRow label="Exits" value={metrics.exits.toLocaleString()} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Search Query Drill Content
// ============================================================================

interface SearchQueryDrillContentProps {
  query: string;
  metrics: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  /** Website URL for generating site-specific Google search link */
  websiteUrl?: string;
}

export function SearchQueryDrillContent({
  query,
  metrics,
  websiteUrl,
}: SearchQueryDrillContentProps) {
  // Generate external Google search URL
  const googleSearchUrl = getGoogleSearchUrl(query, websiteUrl);
  const positionQuality =
    metrics.position <= 3
      ? { label: 'Top 3', color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
      : metrics.position <= 10
      ? { label: 'Page 1', color: 'text-blue-400', bg: 'bg-blue-500/10' }
      : metrics.position <= 20
      ? { label: 'Page 2', color: 'text-amber-400', bg: 'bg-amber-500/10' }
      : { label: 'Page 3+', color: 'text-slate-400', bg: 'bg-slate-500/10' };

  return (
    <div className="space-y-4">
      {/* Query header */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">
          Search Query
        </div>
        <div className="text-lg font-medium text-slate-100">"{query}"</div>
        <div className="mt-2 flex items-center justify-between">
          <span
            className={`text-xs px-2 py-0.5 rounded ${positionQuality.bg} ${positionQuality.color}`}
          >
            {positionQuality.label} • Position {metrics.position.toFixed(1)}
          </span>
          <a
            href={googleSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            Open in Google
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">
            {metrics.clicks.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Clicks</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">
            {metrics.impressions.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Impressions</div>
        </div>
      </div>

      {/* Performance metrics */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
          Performance
        </div>
        <div className="space-y-0">
          <StatRow label="CTR" value={`${(metrics.ctr * 100).toFixed(2)}%`} />
          <StatRow label="Avg Position" value={metrics.position.toFixed(1)} />
          <StatRow
            label="Potential Clicks"
            value={estimatePotentialClicks(metrics.impressions, metrics.position)}
          />
        </div>
      </div>

      {/* Opportunity insight */}
      {metrics.position > 3 && metrics.impressions > 100 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-100">Ranking Opportunity</p>
              <p className="text-xs text-amber-200/70 mt-1">
                Moving this query from position {metrics.position.toFixed(1)} to top 3
                could increase clicks by approximately{' '}
                {Math.round(estimatePotentialClicksNumeric(metrics.impressions, 2.5) - metrics.clicks)}{' '}
                per period.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Channel Drill Content
// ============================================================================

interface ChannelDrillContentProps {
  channel: string;
  metrics: {
    sessions: number;
    users: number;
    conversions: number;
    bounceRate: number;
    percentOfTotal: number;
  };
}

export function ChannelDrillContent({
  channel,
  metrics,
}: ChannelDrillContentProps) {
  const channelColors: Record<string, string> = {
    organic: 'bg-emerald-500',
    paid: 'bg-purple-500',
    social: 'bg-blue-500',
    email: 'bg-amber-500',
    referral: 'bg-cyan-500',
    direct: 'bg-slate-500',
    other: 'bg-slate-600',
  };

  const color = channelColors[channel] || 'bg-slate-600';

  return (
    <div className="space-y-4">
      {/* Channel header */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <span className="text-xs text-slate-500 uppercase tracking-wide">
            Traffic Channel
          </span>
        </div>
        <div className="text-lg font-semibold text-slate-100 capitalize">{channel}</div>
        <div className="text-sm text-slate-400 mt-1">
          {(metrics.percentOfTotal * 100).toFixed(1)}% of total traffic
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">
            {metrics.sessions.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Sessions</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-slate-100">
            {metrics.users.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Users</div>
        </div>
      </div>

      {/* Performance */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-3">
          Performance
        </div>
        <div className="space-y-0">
          <StatRow label="Conversions" value={metrics.conversions.toLocaleString()} />
          <StatRow
            label="Conversion Rate"
            value={`${metrics.sessions > 0 ? ((metrics.conversions / metrics.sessions) * 100).toFixed(2) : 0}%`}
          />
          <StatRow
            label="Bounce Rate"
            value={`${(metrics.bounceRate * 100).toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Channel description */}
      <div className="bg-slate-800/30 rounded-lg p-4">
        <p className="text-sm text-slate-400">{getChannelDescription(channel)}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function classifySourceMedium(source: string, medium: string): string {
  const sourceLower = source.toLowerCase();
  const mediumLower = medium.toLowerCase();

  if (mediumLower === 'organic') {
    return `Organic search traffic from ${source}. This traffic typically has high intent and good conversion potential.`;
  }
  if (mediumLower === 'cpc' || mediumLower === 'ppc' || mediumLower.includes('paid')) {
    return `Paid advertising traffic from ${source}. Monitor ROI and conversion rates closely.`;
  }
  if (mediumLower === 'email') {
    return `Email marketing traffic. Track engagement and segment performance for optimization.`;
  }
  if (mediumLower === 'referral') {
    return `Referral traffic from ${source}. Consider building relationships with high-performing referrers.`;
  }
  if (sourceLower === '(direct)' || mediumLower === '(none)') {
    return `Direct traffic - users who typed your URL or used bookmarks. Often includes brand-aware visitors.`;
  }
  return `Traffic from ${source} via ${medium}. Analyze conversion performance to optimize channel mix.`;
}

function getChannelDescription(channel: string): string {
  const descriptions: Record<string, string> = {
    organic:
      'Organic search traffic from search engines like Google, Bing, etc. This is often high-intent traffic with good conversion potential.',
    paid: 'Paid advertising traffic including PPC, display ads, and sponsored content. Monitor ROI carefully.',
    social:
      'Traffic from social media platforms. Good for brand awareness and community engagement.',
    email:
      'Traffic from email marketing campaigns. Typically engaged users with prior brand interaction.',
    referral:
      'Traffic from other websites linking to you. Quality varies based on referring site.',
    direct:
      'Users who typed your URL directly or used bookmarks. Often includes brand-aware visitors.',
    other:
      'Traffic from sources that don\'t fit other categories. Review UTM parameters for better classification.',
  };
  return descriptions[channel] || 'Traffic from this channel.';
}

function estimatePotentialClicks(impressions: number, position: number): string {
  // Rough CTR estimates by position
  const ctrByPosition: Record<number, number> = {
    1: 0.28,
    2: 0.15,
    3: 0.11,
    4: 0.08,
    5: 0.06,
    6: 0.05,
    7: 0.04,
    8: 0.03,
    9: 0.03,
    10: 0.025,
  };

  const targetCtr = ctrByPosition[Math.min(Math.round(position), 10)] || 0.02;
  const potential = Math.round(impressions * targetCtr);
  return `~${potential.toLocaleString()} (if position holds)`;
}

function estimatePotentialClicksNumeric(impressions: number, targetPosition: number): number {
  const ctrByPosition: Record<number, number> = {
    1: 0.28,
    2: 0.15,
    3: 0.11,
  };
  const targetCtr = ctrByPosition[Math.round(targetPosition)] || 0.11;
  return Math.round(impressions * targetCtr);
}
