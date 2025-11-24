'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DashboardSummary } from '@/lib/os/dashboardSummary';

interface DashboardClientProps {
  summary: DashboardSummary;
}

// Helper to format dates
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

// Format numbers with commas
const formatNumber = (num: number | null | undefined) => {
  if (num === null || num === undefined) return '—';
  return num.toLocaleString();
};

// Format currency
const formatCurrency = (num: number | null | undefined) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export function DashboardClient({ summary }: DashboardClientProps) {
  const [aiBriefing, setAiBriefing] = useState<{
    summary: string;
    bullets: string[];
  } | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Load AI briefing on mount
  useEffect(() => {
    async function loadBriefing() {
      setBriefingLoading(true);
      try {
        const res = await fetch('/api/os/dashboard/ai-briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summary }),
        });
        if (res.ok) {
          const data = await res.json();
          setAiBriefing(data);
        }
      } catch (error) {
        console.warn('[Dashboard] AI briefing unavailable:', error);
      } finally {
        setBriefingLoading(false);
      }
    }
    loadBriefing();
  }, [summary]);

  return (
    <div className="space-y-8">
      {/* Overview KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/os/companies"
            className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
          >
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
              Companies
            </div>
            <div className="text-3xl font-bold text-slate-100">
              {summary.companiesCount}
            </div>
          </Link>

          <Link
            href="/os/gap/ia"
            className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
          >
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
              Assessments (30d)
            </div>
            <div className="text-3xl font-bold text-slate-100">
              {summary.gapAssessments30d}
            </div>
            <div className="text-xs text-slate-500 mt-1">GAP-IA runs</div>
          </Link>

          <Link
            href="/os/gap/plans"
            className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
          >
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
              Plans (30d)
            </div>
            <div className="text-3xl font-bold text-slate-100">
              {summary.gapPlans30d}
            </div>
            <div className="text-xs text-slate-500 mt-1">Growth plans</div>
          </Link>

          <Link
            href="/os/analytics/os"
            className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 hover:border-amber-500/50 transition-colors group"
          >
            <div className="text-xs text-amber-400 uppercase tracking-wide mb-1">
              Growth Analytics
            </div>
            <div className="text-2xl font-bold text-slate-100 group-hover:text-amber-100 transition-colors">
              {summary.growth.sessions30d
                ? formatNumber(summary.growth.sessions30d) + ' sessions'
                : 'View Insights →'}
            </div>
            <div className="text-xs text-amber-500/80 mt-1">GA4 + Search Console</div>
          </Link>
        </div>
      </section>

      {/* Two Column Layout: Client Health + Work */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Client Health */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Client Health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* At-Risk Clients */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-red-400">At Risk</h3>
                <span className="text-xs text-slate-500">
                  {summary.clientHealth.atRisk.length} clients
                </span>
              </div>
              {summary.clientHealth.atRisk.length === 0 ? (
                <div className="text-sm text-slate-500 py-4 text-center">
                  No at-risk clients
                </div>
              ) : (
                <div className="space-y-2">
                  {summary.clientHealth.atRisk.map((client) => (
                    <Link
                      key={client.companyId}
                      href={`/os/${client.companyId}`}
                      className="block p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="text-sm text-slate-200 font-medium truncate">
                        {client.name}
                      </div>
                      <div className="text-xs text-red-400 mt-0.5">
                        {client.reason}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* New Clients */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-emerald-400">New Clients</h3>
                <span className="text-xs text-slate-500">Last 7 days</span>
              </div>
              {summary.clientHealth.newClients.length === 0 ? (
                <div className="text-sm text-slate-500 py-4 text-center">
                  No new clients this week
                </div>
              ) : (
                <div className="space-y-2">
                  {summary.clientHealth.newClients.map((client) => (
                    <Link
                      key={client.companyId}
                      href={`/os/${client.companyId}`}
                      className="block p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="text-sm text-slate-200 font-medium truncate">
                        {client.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Added {formatDate(client.createdAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Work & Delivery */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Work & Delivery
            </h2>
            <Link
              href="/os/work"
              className="text-xs text-amber-500 hover:text-amber-400 font-medium"
            >
              View Workboard →
            </Link>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            {/* Work Stats */}
            <div className="flex items-center gap-6 mb-4 pb-4 border-b border-slate-800">
              <div>
                <div className="text-2xl font-bold text-amber-500">
                  {summary.work.today}
                </div>
                <div className="text-xs text-slate-500">Due Today</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">
                  {summary.work.overdue}
                </div>
                <div className="text-xs text-slate-500">Overdue</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-400">
                  {summary.work.mineToday}
                </div>
                <div className="text-xs text-slate-500">Mine Today</div>
              </div>
            </div>

            {/* Work Items */}
            {summary.work.items.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 text-center">
                No pending work items
              </div>
            ) : (
              <div className="space-y-2">
                {summary.work.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.companyName && <span>{item.companyName}</span>}
                        {item.dueDate && (
                          <span className="ml-2">Due {formatDate(item.dueDate)}</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.status === 'In Progress'
                          ? 'bg-blue-500/10 text-blue-400'
                          : item.status === 'Planned'
                          ? 'bg-purple-500/10 text-purple-400'
                          : 'bg-slate-500/10 text-slate-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Two Column Layout: Pipeline + GAP Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pipeline Snapshot */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Pipeline Snapshot
            </h2>
            <Link
              href="/os/pipeline/opportunities"
              className="text-xs text-amber-500 hover:text-amber-400 font-medium"
            >
              View Pipeline →
            </Link>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            {/* Pipeline Stats */}
            <div className="flex items-center gap-6 mb-4 pb-4 border-b border-slate-800">
              <div>
                <div className="text-2xl font-bold text-blue-400">
                  {summary.pipeline.newLeads30d}
                </div>
                <div className="text-xs text-slate-500">New Leads (30d)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">
                  {summary.pipeline.activeOpportunities}
                </div>
                <div className="text-xs text-slate-500">Active Opps</div>
              </div>
              {summary.pipeline.pipelineValue && (
                <div>
                  <div className="text-2xl font-bold text-amber-400">
                    {formatCurrency(summary.pipeline.pipelineValue)}
                  </div>
                  <div className="text-xs text-slate-500">Pipeline Value</div>
                </div>
              )}
            </div>

            {/* By Stage */}
            {summary.pipeline.byStage.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 text-center">
                No active opportunities
              </div>
            ) : (
              <div className="space-y-2">
                {summary.pipeline.byStage.map((stage) => (
                  <div
                    key={stage.stage}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30"
                  >
                    <span className="text-sm text-slate-300">{stage.stage}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-200">
                        {stage.count}
                      </span>
                      {stage.value && (
                        <span className="text-xs text-slate-500">
                          {formatCurrency(stage.value)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* GAP Activity */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Recent GAP Activity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Assessments */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">
                Assessments
              </h3>
              {summary.recentGap.assessments.length === 0 ? (
                <div className="text-sm text-slate-500 py-2 text-center">
                  No recent assessments
                </div>
              ) : (
                <div className="space-y-2">
                  {summary.recentGap.assessments.map((assessment) => (
                    <Link
                      key={assessment.id}
                      href={
                        assessment.companyId
                          ? `/os/${assessment.companyId}/gap`
                          : `/os/gap/ia`
                      }
                      className="block p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-200 truncate flex-1">
                          {assessment.companyName || assessment.domain}
                        </span>
                        {assessment.score && (
                          <span className="text-sm font-semibold text-amber-500 ml-2">
                            {assessment.score}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatDate(assessment.createdAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Plans */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Plans</h3>
              {summary.recentGap.plans.length === 0 ? (
                <div className="text-sm text-slate-500 py-2 text-center">
                  No recent plans
                </div>
              ) : (
                <div className="space-y-2">
                  {summary.recentGap.plans.map((plan) => (
                    <Link
                      key={plan.id}
                      href={
                        plan.companyId
                          ? `/os/${plan.companyId}/gap`
                          : `/os/gap/plans`
                      }
                      className="block p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="text-sm text-slate-200 truncate">
                        {plan.companyName || 'Unknown'}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {plan.theme && (
                          <span className="text-xs text-purple-400">
                            {plan.theme}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {formatDate(plan.createdAt)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Growth Analytics Teaser */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Growth Analytics
          </h2>
          <Link
            href="/os/analytics/os"
            className="text-xs text-amber-500 hover:text-amber-400 font-medium"
          >
            View Insights →
          </Link>
        </div>
        <div className="bg-gradient-to-br from-slate-900/70 to-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                Sessions (30d)
              </div>
              <div className="text-2xl font-bold text-slate-100">
                {formatNumber(summary.growth.sessions30d)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                Users (30d)
              </div>
              <div className="text-2xl font-bold text-slate-100">
                {formatNumber(summary.growth.users30d)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                DMA Audits (30d)
              </div>
              <div className="text-2xl font-bold text-slate-100">
                {formatNumber(summary.growth.dmaAuditsStarted30d)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                Search Clicks (30d)
              </div>
              <div className="text-2xl font-bold text-slate-100">
                {formatNumber(summary.growth.searchClicks30d)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Briefing */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
          Hive OS Briefing
        </h2>
        <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-6">
          {briefingLoading ? (
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-sm text-slate-400">
                Generating today's briefing...
              </span>
            </div>
          ) : aiBriefing ? (
            <div>
              <p className="text-slate-200 mb-4">{aiBriefing.summary}</p>
              <ul className="space-y-2">
                {aiBriefing.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span className="text-sm text-slate-300">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="text-sm text-slate-400">
              <p className="mb-3">
                AI briefing will analyze your dashboard data and provide:
              </p>
              <ul className="space-y-1 text-slate-500">
                <li>• Today's focus priorities</li>
                <li>• Opportunities to pursue</li>
                <li>• Risks to address</li>
              </ul>
              <p className="mt-3 text-xs text-slate-600">
                Connect the AI briefing API to enable this feature.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
