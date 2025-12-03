// app/c/[companyId]/media/page.tsx
// Company Media Tab - Shows media programs, campaigns, markets, and stores
// for a specific company with V2 scorecard features
//
// MEDIA PROGRAM VISIBILITY:
// - Tab is always present in navigation
// - Content renders conditionally based on company.hasMediaProgram
// - Shows MediaProgramEmptyState when no media program is active

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { companyHasMediaProgram } from '@/lib/companies/media';
import { getMediaOverviewForCompany, getProgramSummariesForCompany } from '@/lib/airtable/mediaOverview';
import { getMediaCampaignsByCompany } from '@/lib/airtable/mediaCampaigns';
import { getMediaMarketsByCompany } from '@/lib/airtable/mediaMarkets';
import { getStoreScorecardsForCompany } from '@/lib/airtable/mediaStores';
import {
  getStoreScorecards,
  getMarketScorecards,
  getMediaKpiSummary,
} from '@/lib/media/analytics';
import {
  formatBudget,
  formatScore,
  getScoreColor,
  getStatusStyles,
  getChannelStyles,
  type MediaProgramSummary,
  type MediaCampaign,
  type MediaMarket,
  type MediaStoreScorecard,
  type MediaChannel,
  type MediaCategory,
  type MediaStoreScorecardV2,
  type MediaMarketScorecard,
  type MediaChannelPerformance,
} from '@/lib/types/media';
import { GenerateMediaWorkButton } from './GenerateMediaWorkButton';
import { MediaProgramEmptyState } from '@/components/os/media';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

// ============================================================================
// Components
// ============================================================================

function StatCard({
  label,
  value,
  subValue,
  color = 'text-slate-100',
}: {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">{label}</p>
      {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  const bgColor = score >= 80 ? 'bg-emerald-500/10' : score >= 60 ? 'bg-amber-500/10' : 'bg-red-500/10';
  return (
    <div className={`flex flex-col items-center px-2 py-1 rounded ${bgColor}`}>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{formatScore(score)}</span>
      {label && <span className="text-[10px] text-slate-500 uppercase">{label}</span>}
    </div>
  );
}

function ChannelBadge({ channel }: { channel: MediaChannel }) {
  const styles = getChannelStyles(channel);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles.color} bg-slate-800/50 border border-slate-700/50`}
    >
      {styles.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: MediaCategory }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-slate-300 bg-slate-800/50 border border-slate-700/50">
      {category}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = getStatusStyles(status as 'Active' | 'Paused' | 'Completed' | 'Planned');
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles.color} ${styles.bgColor} border ${styles.borderColor}`}
    >
      {status}
    </span>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-8 px-4">
      <p className="text-slate-400">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
    </div>
  );
}

// ============================================================================
// KPI Summary Section (V2)
// ============================================================================

function KpiSummarySection({
  kpiSummary,
  overview,
}: {
  kpiSummary: {
    totalSpend: number;
    totalCalls: number;
    totalLsaLeads: number;
    totalInstalls: number;
    totalImpressions: number;
    totalClicks: number;
    avgCpl: number | undefined;
    avgCpc: number | undefined;
    activeStores: number;
    channelBreakdown: MediaChannelPerformance[];
  };
  overview: {
    programCount: number;
    activeCampaignCount: number;
    marketCount: number;
    storeCount: number;
    totalMonthlyBudget: number;
  };
}) {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          label="30-Day Spend"
          value={formatCurrency(kpiSummary.totalSpend)}
          color="text-emerald-400"
          subValue={`Budget: ${formatBudget(overview.totalMonthlyBudget)}`}
        />
        <StatCard
          label="Calls"
          value={formatNumber(kpiSummary.totalCalls)}
          color="text-blue-400"
          subValue={kpiSummary.avgCpl ? `CPL: ${formatCurrency(kpiSummary.avgCpl)}` : undefined}
        />
        <StatCard
          label="LSA Leads"
          value={formatNumber(kpiSummary.totalLsaLeads)}
          color="text-purple-400"
        />
        <StatCard
          label="Installs"
          value={formatNumber(kpiSummary.totalInstalls)}
          color="text-amber-400"
        />
        <StatCard
          label="Impressions"
          value={formatNumber(kpiSummary.totalImpressions)}
          subValue={kpiSummary.totalClicks ? `${formatNumber(kpiSummary.totalClicks)} clicks` : undefined}
        />
        <StatCard
          label="Active Stores"
          value={kpiSummary.activeStores}
          subValue={`${overview.marketCount} markets`}
        />
      </div>

      {/* Channel Mix Bar */}
      {kpiSummary.channelBreakdown.length > 0 && (
        <ChannelMixSection breakdown={kpiSummary.channelBreakdown} />
      )}
    </div>
  );
}

function ChannelMixSection({ breakdown }: { breakdown: MediaChannelPerformance[] }) {
  const totalSpend = breakdown.reduce((sum, c) => sum + c.spend, 0);
  if (totalSpend === 0) return null;

  const channelColors: Record<MediaChannel, string> = {
    Search: 'bg-blue-500',
    Maps: 'bg-emerald-500',
    LSAs: 'bg-purple-500',
    Social: 'bg-pink-500',
    Display: 'bg-cyan-500',
    Radio: 'bg-orange-500',
    Other: 'bg-slate-500',
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
        Channel Mix (Last 30 Days)
      </h3>
      {/* Bar */}
      <div className="h-6 rounded-lg overflow-hidden flex mb-3">
        {breakdown.map(({ channel, spend }) => {
          const percentage = (spend / totalSpend) * 100;
          if (percentage < 1) return null;
          return (
            <div
              key={channel}
              className={`${channelColors[channel]} flex items-center justify-center transition-all`}
              style={{ width: `${percentage}%` }}
              title={`${channel}: ${formatCurrency(spend)} (${percentage.toFixed(1)}%)`}
            >
              {percentage > 12 && (
                <span className="text-[10px] font-medium text-white/90">{channel}</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {breakdown.map(({ channel, spend, calls, lsaLeads }) => (
          <div key={channel} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded ${channelColors[channel]}`} />
            <div className="text-xs">
              <span className="text-slate-300 font-medium">{channel}</span>
              <span className="text-slate-500 ml-1.5">{formatCurrency(spend)}</span>
              {(calls > 0 || lsaLeads > 0) && (
                <span className="text-slate-600 ml-1">
                  ({calls} calls{lsaLeads > 0 ? `, ${lsaLeads} leads` : ''})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Section Components
// ============================================================================

function ProgramsSection({ programs }: { programs: MediaProgramSummary[] }) {
  if (programs.length === 0) {
    return (
      <EmptyState
        title="No media programs"
        description="Create programs in Airtable to track media initiatives"
      />
    );
  }

  return (
    <div className="divide-y divide-slate-800">
      {programs.map(({ program, campaignCount, marketCount, storeCount, totalMonthlyBudget }) => (
        <div
          key={program.id}
          className="p-4 hover:bg-slate-800/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium text-slate-200 truncate">
                  {program.name}
                </h3>
                <StatusBadge status={program.status} />
                {program.seasonal && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30">
                    Seasonal
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-2">
                {program.objective} • {marketCount} market{marketCount !== 1 ? 's' : ''} • {storeCount} store{storeCount !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-1">
                {program.primaryChannels.map((channel) => (
                  <ChannelBadge key={channel} channel={channel} />
                ))}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-medium text-slate-200 tabular-nums">
                {formatBudget(totalMonthlyBudget)}
              </p>
              <p className="text-xs text-slate-500">/month</p>
              <p className="text-xs text-slate-400 mt-1">
                {campaignCount} campaign{campaignCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignsSection({ campaigns }: { campaigns: MediaCampaign[] }) {
  if (campaigns.length === 0) {
    return (
      <EmptyState
        title="No campaigns"
        description="Campaigns will appear here once linked to programs"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Campaign
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Channel
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Market
            </th>
            <th className="text-left py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Status
            </th>
            <th className="text-right py-2 px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Budget
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {campaigns.slice(0, 10).map((campaign) => (
            <tr key={campaign.id} className="hover:bg-slate-800/30 transition-colors">
              <td className="py-2 px-3">
                <span className="text-sm text-slate-200">{campaign.name}</span>
              </td>
              <td className="py-2 px-3">
                <ChannelBadge channel={campaign.channel} />
              </td>
              <td className="py-2 px-3">
                <span className="text-sm text-slate-400">{campaign.marketName || '—'}</span>
              </td>
              <td className="py-2 px-3">
                <StatusBadge status={campaign.status} />
              </td>
              <td className="py-2 px-3 text-right">
                <span className="text-sm text-slate-300 tabular-nums">
                  {formatBudget(campaign.monthlyBudget)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {campaigns.length > 10 && (
        <p className="text-xs text-slate-500 text-center py-2">
          +{campaigns.length - 10} more campaigns
        </p>
      )}
    </div>
  );
}

function MarketsV2Section({ markets }: { markets: MediaMarketScorecard[] }) {
  if (markets.length === 0) {
    return (
      <EmptyState
        title="No markets defined"
        description="Add markets in Airtable to organize stores by geography"
      />
    );
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {markets.map((market) => (
        <div
          key={market.marketId}
          className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium text-slate-200">{market.marketName}</h4>
              {market.region && (
                <p className="text-xs text-slate-500">{market.region}</p>
              )}
            </div>
            <span className="text-xs text-slate-400">
              {market.storeCount} store{market.storeCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Scores */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <ScoreBadge score={market.visibilityScore} label="Vis" />
            <ScoreBadge score={market.demandScore} label="Dem" />
            <ScoreBadge score={market.conversionScore} label="Conv" />
            <div className="flex-1" />
            <div className="text-right">
              <p className={`text-lg font-bold tabular-nums ${getScoreColor(market.overallScore)}`}>
                {formatScore(market.overallScore)}
              </p>
              <p className="text-[10px] text-slate-500 uppercase">Overall</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-700/50 pt-3">
            <div>
              <p className="text-sm font-medium text-slate-300 tabular-nums">{market.calls.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500">Calls</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300 tabular-nums">{market.lsaLeads.toLocaleString()}</p>
              <p className="text-[10px] text-slate-500">Leads</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300 tabular-nums">{formatCurrency(market.spend)}</p>
              <p className="text-[10px] text-slate-500">Spend</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StoreScorecardsV2Section({ scorecards }: { scorecards: MediaStoreScorecardV2[] }) {
  if (scorecards.length === 0) {
    return (
      <EmptyState
        title="No stores defined"
        description="Add stores in Airtable to track location-level performance"
      />
    );
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {scorecards.map((scorecard) => (
        <div
          key={scorecard.storeId}
          className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 hover:border-slate-600/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium text-slate-200">{scorecard.storeName}</h4>
              <p className="text-xs text-slate-500">
                {scorecard.marketName || scorecard.storeCode || '—'}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xl font-bold tabular-nums ${getScoreColor(scorecard.overallScore)}`}>
                {formatScore(scorecard.overallScore)}
              </p>
              <p className="text-[10px] text-slate-500 uppercase">Overall</p>
            </div>
          </div>

          {/* Score badges row */}
          <div className="flex items-center gap-2 mb-3">
            <ScoreBadge score={scorecard.visibilityScore} label="Vis" />
            <ScoreBadge score={scorecard.demandScore} label="Dem" />
            <ScoreBadge score={scorecard.conversionScore} label="Conv" />
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-4 gap-1 text-center border-t border-slate-700/50 pt-3">
            <div>
              <p className="text-xs font-medium text-slate-300 tabular-nums">{scorecard.calls.toLocaleString()}</p>
              <p className="text-[9px] text-slate-500">Calls</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300 tabular-nums">{scorecard.lsaLeads.toLocaleString()}</p>
              <p className="text-[9px] text-slate-500">Leads</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300 tabular-nums">{scorecard.installs.toLocaleString()}</p>
              <p className="text-[9px] text-slate-500">Installs</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-300 tabular-nums">{formatCurrency(scorecard.spend)}</p>
              <p className="text-[9px] text-slate-500">Spend</p>
            </div>
          </div>

          {/* CPL/CTR if available */}
          {(scorecard.cpl || scorecard.ctr) && (
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-800/50">
              {scorecard.cpl && (
                <span className="text-[10px] text-slate-500">
                  CPL: <span className="text-slate-400">{formatCurrency(scorecard.cpl)}</span>
                </span>
              )}
              {scorecard.ctr && (
                <span className="text-[10px] text-slate-500">
                  CTR: <span className="text-slate-400">{(scorecard.ctr * 100).toFixed(2)}%</span>
                </span>
              )}
            </div>
          )}

          {/* Category mix */}
          {scorecard.categoryMix.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {scorecard.categoryMix.map((cat) => (
                <CategoryBadge key={cat} category={cat} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Legacy Markets Section (fallback)
function MarketsSection({ markets }: { markets: MediaMarket[] }) {
  if (markets.length === 0) {
    return (
      <EmptyState
        title="No markets defined"
        description="Add markets in Airtable to organize stores by geography"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {markets.map((market) => (
        <div
          key={market.id}
          className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="text-sm font-medium text-slate-200">{market.name}</h4>
              {market.region && (
                <p className="text-xs text-slate-500">{market.region}</p>
              )}
            </div>
            <span className="text-xs text-slate-400">
              {market.storeIds.length} store{market.storeIds.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center">
              <p className={`text-lg font-bold tabular-nums ${getScoreColor(market.visibilityScore)}`}>
                {formatScore(market.visibilityScore)}
              </p>
              <p className="text-[10px] text-slate-500 uppercase">Visibility</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold tabular-nums ${getScoreColor(market.demandScore)}`}>
                {formatScore(market.demandScore)}
              </p>
              <p className="text-[10px] text-slate-500 uppercase">Demand</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold tabular-nums ${getScoreColor(market.conversionScore)}`}>
                {formatScore(market.conversionScore)}
              </p>
              <p className="text-[10px] text-slate-500 uppercase">Conv.</p>
            </div>
          </div>
          {market.primaryCategories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {market.primaryCategories.slice(0, 3).map((cat) => (
                <CategoryBadge key={cat} category={cat} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Legacy Store Scorecards Section (fallback)
function StoreScorecardsSection({ scorecards }: { scorecards: MediaStoreScorecard[] }) {
  if (scorecards.length === 0) {
    return (
      <EmptyState
        title="No stores defined"
        description="Add stores in Airtable to track location-level performance"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {scorecards.map(({ store, visibilityScore, demandScore, conversionScore, overallScore, categoryMixParsed }) => (
        <div
          key={store.id}
          className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium text-slate-200">{store.name}</h4>
              <p className="text-xs text-slate-500">
                {store.marketName || store.city || '—'}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xl font-bold tabular-nums ${getScoreColor(overallScore)}`}>
                {formatScore(overallScore)}
              </p>
              <p className="text-[10px] text-slate-500 uppercase">Overall</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded bg-slate-900/50">
              <p className={`text-sm font-bold tabular-nums ${getScoreColor(visibilityScore)}`}>
                {formatScore(visibilityScore)}
              </p>
              <p className="text-[10px] text-slate-500">Visibility</p>
            </div>
            <div className="text-center p-2 rounded bg-slate-900/50">
              <p className={`text-sm font-bold tabular-nums ${getScoreColor(demandScore)}`}>
                {formatScore(demandScore)}
              </p>
              <p className="text-[10px] text-slate-500">Demand</p>
            </div>
            <div className="text-center p-2 rounded bg-slate-900/50">
              <p className={`text-sm font-bold tabular-nums ${getScoreColor(conversionScore)}`}>
                {formatScore(conversionScore)}
              </p>
              <p className="text-[10px] text-slate-500">Conv.</p>
            </div>
          </div>

          {categoryMixParsed.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {categoryMixParsed.map((cat) => (
                <CategoryBadge key={cat} category={cat} />
              ))}
            </div>
          )}

          {store.callTrackingNumber && (
            <p className="text-xs text-slate-500 mt-2">
              Tracking: {store.callTrackingNumber}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default async function CompanyMediaPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Check if company has an active media program
  const showMedia = companyHasMediaProgram(company);

  // If no media program, show empty state
  if (!showMedia) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Media
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Performance media, demand generation, and store-level install performance.
          </p>
        </div>
        <MediaProgramEmptyState company={company} />
      </div>
    );
  }

  // Fetch all media data in parallel - V2 analytics + legacy data
  const [
    overview,
    programSummaries,
    campaigns,
    legacyMarkets,
    legacyScorecards,
    kpiSummary,
    marketScorecardsV2,
    storeScorecardsV2,
  ] = await Promise.all([
    getMediaOverviewForCompany(companyId),
    getProgramSummariesForCompany(companyId),
    getMediaCampaignsByCompany(companyId),
    getMediaMarketsByCompany(companyId),
    getStoreScorecardsForCompany(companyId),
    getMediaKpiSummary(companyId),
    getMarketScorecards(companyId),
    getStoreScorecards(companyId),
  ]);

  // Use V2 scorecards if available, otherwise fall back to legacy
  const hasV2Scorecards = storeScorecardsV2.length > 0;
  const hasV2Markets = marketScorecardsV2.length > 0;

  const hasAnyData =
    programSummaries.length > 0 ||
    campaigns.length > 0 ||
    legacyMarkets.length > 0 ||
    legacyScorecards.length > 0 ||
    storeScorecardsV2.length > 0;

  return (
    <div className="space-y-8">
      {/* Header with Generate Work Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Media Performance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Last 30 days • {overview.storeCount} stores • {overview.marketCount} markets
          </p>
        </div>
        {hasV2Scorecards && (
          <GenerateMediaWorkButton companyId={companyId} companyName={company.name} />
        )}
      </div>

      {/* KPI Summary Section */}
      <section>
        <KpiSummarySection kpiSummary={kpiSummary} overview={overview} />
      </section>

      {!hasAnyData && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
          <h3 className="text-lg font-medium text-slate-300 mb-2">
            No Media Data Yet
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            This company has an active media program but no data has been synced yet.
            Add programs, campaigns, or stores in Airtable to start tracking performance.
          </p>
          <Link
            href="/media"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors text-sm font-medium"
          >
            View Global Media Hub
          </Link>
        </div>
      )}

      {/* Programs */}
      {programSummaries.length > 0 && (
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300">Media Programs</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {programSummaries.length} program{programSummaries.length !== 1 ? 's' : ''}
            </p>
          </div>
          <ProgramsSection programs={programSummaries} />
        </section>
      )}

      {/* Campaigns */}
      {campaigns.length > 0 && (
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-300">Campaigns</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {campaigns.filter((c) => c.status === 'Active').length} active of {campaigns.length} total
            </p>
          </div>
          <CampaignsSection campaigns={campaigns} />
        </section>
      )}

      {/* Markets (V2 or Legacy) */}
      {(hasV2Markets || legacyMarkets.length > 0) && (
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Markets</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasV2Markets ? marketScorecardsV2.length : legacyMarkets.length} market{(hasV2Markets ? marketScorecardsV2.length : legacyMarkets.length) !== 1 ? 's' : ''}
              {hasV2Markets && ' • With computed scorecards'}
            </p>
          </div>
          {hasV2Markets ? (
            <MarketsV2Section markets={marketScorecardsV2} />
          ) : (
            <MarketsSection markets={legacyMarkets} />
          )}
        </section>
      )}

      {/* Store Scorecards (V2 or Legacy) */}
      {(hasV2Scorecards || legacyScorecards.length > 0) && (
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-300">Store Scorecards</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasV2Scorecards ? storeScorecardsV2.length : legacyScorecards.length} store{(hasV2Scorecards ? storeScorecardsV2.length : legacyScorecards.length) !== 1 ? 's' : ''}
                {hasV2Scorecards && ' • Sorted by overall score'}
              </p>
            </div>
            {hasV2Scorecards && storeScorecardsV2.some(s => s.overallScore < 50) && (
              <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/30">
                {storeScorecardsV2.filter(s => s.overallScore < 50).length} stores need attention
              </span>
            )}
          </div>
          {hasV2Scorecards ? (
            <StoreScorecardsV2Section scorecards={storeScorecardsV2} />
          ) : (
            <StoreScorecardsSection scorecards={legacyScorecards} />
          )}
        </section>
      )}

      {/* Seasonal Performance Stub */}
      <section className="bg-slate-900/30 border border-slate-800/50 border-dashed rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-400">Seasonal Performance</h2>
            <p className="text-xs text-slate-500 mt-0.5">Coming soon • Compare YoY performance</p>
          </div>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded uppercase tracking-wide">
            Planned
          </span>
        </div>
        <p className="text-sm text-slate-500 max-w-2xl">
          This section will show seasonal trends, year-over-year comparisons, and help identify
          optimal timing for media campaigns based on historical performance data.
        </p>
      </section>
    </div>
  );
}
