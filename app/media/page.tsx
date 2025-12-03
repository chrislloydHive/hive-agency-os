// app/media/page.tsx
// Global Media Hub V2 - Performance media command center
// Shows all media programs, campaigns, markets, stores, and performance metrics
// across all companies

import { Suspense } from 'react';
import Link from 'next/link';
import { getGlobalMediaSummary } from '@/lib/airtable/mediaOverview';
import { getAllMediaPrograms } from '@/lib/airtable/mediaPrograms';
import { getAllMediaStores } from '@/lib/airtable/mediaStores';
import {
  formatBudget,
  formatScore,
  formatCompactNumber,
  getScoreColor,
  getScoreBgColor,
  getStatusStyles,
  getChannelStyles,
  type MediaProgram,
  type MediaStore,
  type MediaChannel,
} from '@/lib/types/media';

export const dynamic = 'force-dynamic';

// ============================================================================
// Data Fetching
// ============================================================================

async function getMediaHubData() {
  const [summary, programs, stores] = await Promise.all([
    getGlobalMediaSummary(),
    getAllMediaPrograms(),
    getAllMediaStores(),
  ]);

  // Sort stores by visibility + demand + conversion score
  const sortedStores = [...stores].sort((a, b) => {
    const aScore = (a.visibilityScore || 0) + (a.demandScore || 0) + (a.conversionScore || 0);
    const bScore = (b.visibilityScore || 0) + (b.demandScore || 0) + (b.conversionScore || 0);
    return bScore - aScore;
  });

  return { summary, programs, stores: sortedStores };
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function MediaHubSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="h-8 w-12 bg-slate-700 rounded mb-2" />
            <div className="h-3 w-16 bg-slate-800 rounded" />
          </div>
        ))}
      </div>
      {/* Channel breakdown skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 h-48" />
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 h-48" />
      </div>
      {/* Table skeleton */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
        <div className="h-6 w-32 bg-slate-700 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-800/50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

function StatCard({
  label,
  value,
  subValue,
  trend,
  large,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  large?: boolean;
}) {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      <p className={`${large ? 'text-4xl' : 'text-3xl'} font-bold text-slate-100 tabular-nums`}>
        {value}
      </p>
      <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">{label}</p>
      {subValue && (
        <p className={`text-xs mt-0.5 ${trend ? trendColors[trend] : 'text-slate-500'}`}>
          {subValue}
        </p>
      )}
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

function StatusBadge({ status }: { status: MediaProgram['status'] }) {
  const styles = getStatusStyles(status);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles.color} ${styles.bgColor} border ${styles.borderColor}`}
    >
      {status}
    </span>
  );
}

function ScoreBadge({ score, label }: { score?: number; label: string }) {
  const color = getScoreColor(score);
  const bgColor = getScoreBgColor(score);

  return (
    <div className={`inline-flex flex-col items-center px-3 py-2 rounded-lg ${bgColor} border border-slate-700/30`}>
      <span className={`text-lg font-bold tabular-nums ${color}`}>
        {formatScore(score)}
      </span>
      <span className="text-[10px] text-slate-500 uppercase">{label}</span>
    </div>
  );
}

function ChannelMixBar({ breakdown }: { breakdown: Record<MediaChannel, number> }) {
  const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;

  const channels = Object.entries(breakdown)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  const channelColors: Record<MediaChannel, string> = {
    Search: 'bg-blue-500',
    Maps: 'bg-emerald-500',
    LSAs: 'bg-purple-500',
    Social: 'bg-pink-500',
    Display: 'bg-cyan-500',
    Radio: 'bg-orange-500',
    Other: 'bg-slate-500',
  };

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="h-8 rounded-lg overflow-hidden flex">
        {channels.map(([channel, count]) => {
          const percentage = (count / total) * 100;
          return (
            <div
              key={channel}
              className={`${channelColors[channel as MediaChannel]} flex items-center justify-center`}
              style={{ width: `${percentage}%` }}
              title={`${channel}: ${count} (${percentage.toFixed(1)}%)`}
            >
              {percentage > 10 && (
                <span className="text-xs font-medium text-white/90">{channel}</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {channels.map(([channel, count]) => (
          <div key={channel} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${channelColors[channel as MediaChannel]}`} />
            <span className="text-xs text-slate-400">
              {channel}: <span className="text-slate-300 font-medium">{count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopStoresCard({ stores }: { stores: MediaStore[] }) {
  const topStores = stores.slice(0, 5);

  if (topStores.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400">No stores with performance data</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {topStores.map((store, index) => {
        const overallScore = Math.round(
          ((store.visibilityScore || 0) + (store.demandScore || 0) + (store.conversionScore || 0)) / 3
        );
        return (
          <Link
            key={store.id}
            href={`/c/${store.companyId}/media`}
            className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs font-medium text-slate-300">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate group-hover:text-amber-400 transition-colors">
                {store.name}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {store.companyName} • {store.marketName || 'No market'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ScoreBadge score={store.visibilityScore} label="Vis" />
              <ScoreBadge score={store.demandScore} label="Dem" />
              <ScoreBadge score={store.conversionScore} label="Conv" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ProgramsTable({ programs }: { programs: MediaProgram[] }) {
  if (programs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400">No media programs found</p>
        <p className="text-sm text-slate-500 mt-1">
          Programs will appear here once created in Airtable
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Company
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Program
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Status
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Objective
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Markets
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Channels
            </th>
            <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Monthly Budget
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {programs.map((program) => (
            <tr
              key={program.id}
              className="hover:bg-slate-800/30 transition-colors"
            >
              <td className="py-3 px-4">
                <Link
                  href={`/c/${program.companyId}/media`}
                  className="text-sm text-slate-300 hover:text-amber-400 transition-colors"
                >
                  {program.companyName || 'Unknown'}
                </Link>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200 font-medium">
                    {program.name}
                  </span>
                  {program.seasonal && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30">
                      Seasonal
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={program.status} />
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-400">{program.objective}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-400">
                  {program.marketNames?.join(', ') || program.marketIds.length || '—'}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex flex-wrap gap-1">
                  {program.primaryChannels.slice(0, 3).map((channel) => (
                    <ChannelBadge key={channel} channel={channel} />
                  ))}
                  {program.primaryChannels.length > 3 && (
                    <span className="text-xs text-slate-500">
                      +{program.primaryChannels.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-right">
                <span className="text-sm text-slate-300 tabular-nums">
                  {formatBudget(program.monthlyBudget)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StoresTable({ stores }: { stores: MediaStore[] }) {
  if (stores.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400">No media stores found</p>
        <p className="text-sm text-slate-500 mt-1">
          Stores will appear here once created in Airtable
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Company
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Store
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Market
            </th>
            <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Visibility
            </th>
            <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Demand
            </th>
            <th className="text-center py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Conversion
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {stores.map((store) => (
            <tr
              key={store.id}
              className="hover:bg-slate-800/30 transition-colors"
            >
              <td className="py-3 px-4">
                <Link
                  href={`/c/${store.companyId}/media`}
                  className="text-sm text-slate-300 hover:text-amber-400 transition-colors"
                >
                  {store.companyName || 'Unknown'}
                </Link>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200 font-medium">
                    {store.name}
                  </span>
                  {store.storeCode && (
                    <span className="text-xs text-slate-500">
                      ({store.storeCode})
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-400">
                  {store.marketName || '—'}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`text-sm font-medium tabular-nums ${getScoreColor(store.visibilityScore)}`}
                >
                  {formatScore(store.visibilityScore)}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`text-sm font-medium tabular-nums ${getScoreColor(store.demandScore)}`}
                >
                  {formatScore(store.demandScore)}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`text-sm font-medium tabular-nums ${getScoreColor(store.conversionScore)}`}
                >
                  {formatScore(store.conversionScore)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

async function MediaHubContent() {
  const { summary, programs, stores } = await getMediaHubData();

  // Calculate totals
  const activePrograms = programs.filter((p) => p.status === 'Active').length;
  const totalBudget = programs
    .filter((p) => p.status === 'Active')
    .reduce((sum, p) => sum + (p.monthlyBudget || 0), 0);

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Media Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Programs" value={summary.totalPrograms} />
          <StatCard label="Active Programs" value={activePrograms} />
          <StatCard label="Active Campaigns" value={summary.totalActiveCampaigns} />
          <StatCard label="Markets" value={summary.totalMarkets} />
          <StatCard label="Stores" value={summary.totalStores} />
          <StatCard label="Monthly Budget" value={formatBudget(totalBudget)} />
        </div>
      </section>

      {/* Channel Mix + Top Stores */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Mix */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Active Campaigns by Channel
          </h2>
          <ChannelMixBar breakdown={summary.channelBreakdown} />
        </div>

        {/* Top Stores */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Top Performing Stores
          </h2>
          <TopStoresCard stores={stores} />
        </div>
      </section>

      {/* Company Breakdown */}
      {summary.companyBreakdown.length > 0 && (
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">
            Companies with Media
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {summary.companyBreakdown.map((company) => (
              <Link
                key={company.companyId}
                href={`/c/${company.companyId}/media`}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-slate-200 group-hover:text-amber-400 transition-colors">
                    {company.companyName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {company.programCount} program{company.programCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-100">
                    {company.activeCampaignCount}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">Active</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Programs Table */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300">
            All Media Programs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {programs.length} program{programs.length !== 1 ? 's' : ''} across all companies
          </p>
        </div>
        <ProgramsTable programs={programs} />
      </section>

      {/* Stores Table */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300">
            All Media Stores
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {stores.length} store{stores.length !== 1 ? 's' : ''} across all companies
          </p>
        </div>
        <StoresTable stores={stores} />
      </section>
    </div>
  );
}

export default function MediaPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-100">Media</h1>
        <p className="text-slate-400 mt-1">
          Performance media command center - programs, campaigns, and store-level tracking
        </p>
      </div>

      <Suspense fallback={<MediaHubSkeleton />}>
        <MediaHubContent />
      </Suspense>
    </div>
  );
}
