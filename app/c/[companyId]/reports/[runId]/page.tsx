// app/c/[companyId]/reports/[runId]/page.tsx
// Report Detail Page - Shows full details of a specific diagnostic run
//
// This page attempts to find the run in the unified Diagnostic Runs table first,
// then falls back to the legacy GAP-Plan Run table for backwards compatibility.

import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getDiagnosticRun, isValidToolId } from '@/lib/os/diagnostics/runs';
import { getToolConfig } from '@/lib/os/diagnostics/tools';
import { getToolByDiagnosticId } from '@/lib/tools/registry';
import { extractReportData } from '@/lib/os/diagnostics/adapters';
import { ToolReportLayout, type ReportSection } from '@/components/tools/ToolReportLayout';
import { countWorkItemsForRun } from '@/lib/airtable/workItems';

interface ReportPageProps {
  params: Promise<{ companyId: string; runId: string }>;
}

export const dynamic = 'force-dynamic';

// Legacy function to get GAP-Plan specific runs
async function getGapPlanRun(runId: string) {
  const { getAirtableConfig } = await import('@/lib/airtable/client');
  const config = getAirtableConfig();

  const url = `https://api.airtable.com/v0/${config.baseId}/GAP-Plan%20Run?filterByFormula=${encodeURIComponent(`RECORD_ID() = '${runId}'`)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data.records || data.records.length === 0) {
    return null;
  }

  const record = data.records[0];
  const fields = record.fields;

  // Parse the Data JSON field
  let reportData = null;
  if (fields['Data JSON']) {
    try {
      reportData = JSON.parse(fields['Data JSON']);
    } catch (e) {
      console.error('Failed to parse Data JSON:', e);
    }
  }

  return {
    id: record.id,
    runId: fields['Company ID'],
    url: fields['URL'],
    status: fields['Status'],
    progress: fields['Progress'],
    createdAt: fields['Created At'],
    completedAt: fields['Completed At'],
    reportData,
  };
}

// Legacy function to get GAP-IA specific runs
async function getGapIaRun(runId: string) {
  const { getAirtableConfig } = await import('@/lib/airtable/client');
  const config = getAirtableConfig();

  const url = `https://api.airtable.com/v0/${config.baseId}/GAP-IA%20Run?filterByFormula=${encodeURIComponent(`RECORD_ID() = '${runId}'`)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data.records || data.records.length === 0) {
    return null;
  }

  const record = data.records[0];
  const fields = record.fields;

  // Parse the Result JSON field
  let reportData = null;
  if (fields['Result JSON']) {
    try {
      reportData = JSON.parse(fields['Result JSON']);
    } catch (e) {
      console.error('Failed to parse Result JSON:', e);
    }
  }

  return {
    id: record.id,
    type: 'gap_ia' as const,
    status: fields['Status'],
    createdAt: fields['Created At'],
    reportData,
  };
}

// Legacy function to get GAP-Heavy specific runs
async function getGapHeavyRun(runId: string) {
  const { getAirtableConfig } = await import('@/lib/airtable/client');
  const config = getAirtableConfig();

  const url = `https://api.airtable.com/v0/${config.baseId}/Heavy%20GAP%20Run?filterByFormula=${encodeURIComponent(`RECORD_ID() = '${runId}'`)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data.records || data.records.length === 0) {
    return null;
  }

  const record = data.records[0];
  const fields = record.fields;

  // Parse the Evidence Pack JSON field
  let reportData = null;
  if (fields['Evidence Pack JSON']) {
    try {
      reportData = JSON.parse(fields['Evidence Pack JSON']);
    } catch (e) {
      console.error('Failed to parse Evidence Pack JSON:', e);
    }
  }

  return {
    id: record.id,
    type: 'gap_heavy' as const,
    status: fields['Status'],
    createdAt: fields['Created At'],
    reportData,
  };
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { companyId, runId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // First, try to find the run in the unified Diagnostic Runs table
  const diagnosticRun = await getDiagnosticRun(runId);

  if (diagnosticRun && diagnosticRun.companyId === companyId) {
    // Found in unified table - check if we have a tool definition
    const tool = getToolConfig(diagnosticRun.toolId);
    const unifiedTool = getToolByDiagnosticId(diagnosticRun.toolId);

    // If the tool has a dedicated view route, redirect there
    if (unifiedTool?.urlSlug) {
      redirect(`/c/${companyId}/diagnostics/${unifiedTool.urlSlug}/${runId}`);
    }

    // Only use unified report layout if we have rawJson data
    // Otherwise fall through to legacy tables which may have the actual data
    if (tool && diagnosticRun.rawJson) {
      const workItemCount = await countWorkItemsForRun(runId);
      const reportData = extractReportData(diagnosticRun);

      // Double-check we actually have content to show
      const hasContent = reportData.scores.length > 0 ||
                         reportData.keyFindings.length > 0 ||
                         reportData.sections.length > 0;

      if (hasContent) {
        return (
          <ToolReportLayout
            tool={tool}
            company={company}
            run={diagnosticRun}
            scores={reportData.scores}
            keyFindings={reportData.keyFindings}
            opportunities={reportData.opportunities}
            sections={reportData.sections as ReportSection[]}
            workItemCount={workItemCount}
          />
        );
      }
      // If no content extracted, fall through to legacy tables
    }
  }

  // Fall back to legacy tables - try GAP-IA, GAP-Heavy, then GAP-Plan
  const gapIaRun = await getGapIaRun(runId);
  if (gapIaRun?.reportData) {
    // Render GAP-IA report
    const ia = gapIaRun.reportData.initialAssessment || gapIaRun.reportData;
    const dimensions = ia.dimensions || {};
    const summary = ia.summary || {};

    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/c/${companyId}/reports`}
              className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block"
            >
              ← Back to Reports
            </Link>
            <h1 className="text-3xl font-bold text-slate-100">GAP Initial Assessment</h1>
            <p className="text-slate-400 mt-1">{company.name}</p>
          </div>
        </div>

        {/* Maturity Stage */}
        {summary.maturityStage && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Maturity Stage</h2>
            <div className="flex items-center gap-4">
              <span className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg font-medium capitalize">
                {summary.maturityStage}
              </span>
              {summary.overallScore && (
                <span className="text-2xl font-bold text-white">
                  {Math.round(summary.overallScore)}<span className="text-sm text-slate-500">/100</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Executive Summary */}
        {summary.narrative && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Executive Summary</h2>
            <p className="text-slate-300 leading-relaxed whitespace-pre-line">{summary.narrative}</p>
          </div>
        )}

        {/* Dimensions */}
        {Object.keys(dimensions).length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Dimension Scores</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(dimensions).map(([key, dim]: [string, any]) => (
                <div key={key} className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    {dim.score !== undefined && (
                      <span className={`font-bold ${dim.score >= 70 ? 'text-emerald-400' : dim.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {Math.round(dim.score)}
                      </span>
                    )}
                  </div>
                  {dim.summary && <p className="text-sm text-slate-400">{dim.summary}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Priorities */}
        {ia.priorities && ia.priorities.length > 0 && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Top Priorities</h2>
            <div className="space-y-3">
              {ia.priorities.slice(0, 10).map((p: any, idx: number) => (
                <div key={idx} className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-white">{p.title || p.name}</div>
                    {p.description && <p className="text-sm text-slate-400 mt-1">{p.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const gapHeavyRun = await getGapHeavyRun(runId);
  if (gapHeavyRun?.reportData) {
    // Redirect to dedicated GAP Heavy view if available
    redirect(`/c/${companyId}/diagnostics/gap-heavy/${runId}`);
  }

  const legacyRun = await getGapPlanRun(runId);

  if (!legacyRun) {
    notFound();
  }

  if (!legacyRun.reportData) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/c/${companyId}/reports`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Reports
          </Link>
        </div>
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-amber-300 mb-2">
            Report Not Available
          </h2>
          <p className="text-slate-400">
            This run hasn&apos;t completed yet or the report data is missing.
          </p>
        </div>
      </div>
    );
  }

  // Render legacy GAP Plan report
  const report = legacyRun.reportData;
  const scorecard = report.scorecard || {};
  const summary = report.executiveSummary || {};
  const quickWins = report.quickWins || [];
  const initiatives = report.strategicInitiatives || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/c/${companyId}/reports`}
            className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block"
          >
            ← Back to Reports
          </Link>
          <h1 className="text-3xl font-bold text-slate-100">Growth Action Plan</h1>
          <p className="text-slate-400 mt-1">
            {report.companyName || company.name} • {legacyRun.url}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Scorecard */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-slate-200 mb-4">Scorecard</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Overall', value: scorecard.overall, color: 'text-emerald-400' },
            { label: 'Website', value: scorecard.website, color: 'text-blue-400' },
            { label: 'Content', value: scorecard.content, color: 'text-purple-400' },
            { label: 'SEO', value: scorecard.seo, color: 'text-amber-400' },
            { label: 'Brand', value: scorecard.brand, color: 'text-pink-400' },
            { label: 'Authority', value: scorecard.authority, color: 'text-cyan-400' },
          ].map((metric) => (
            <div key={metric.label} className="bg-slate-800/50 rounded-lg p-4 text-center">
              <div className={`text-3xl font-bold ${metric.color}`}>
                {metric.value !== undefined ? Math.round(metric.value) : '—'}
              </div>
              <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-slate-200 mb-4">Executive Summary</h2>

        <div className="mb-4">
          <span className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-sm font-medium">
            {summary.maturityStage || 'N/A'}
          </span>
        </div>

        <p className="text-slate-300 leading-relaxed mb-6">{summary.narrative}</p>

        {summary.strengths && summary.strengths.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2 uppercase tracking-wide">
              Strengths
            </h3>
            <ul className="space-y-2">
              {summary.strengths.map((strength: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-slate-300">
                  <span className="text-emerald-400 mt-1">✓</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.keyIssues && summary.keyIssues.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-amber-400 mb-2 uppercase tracking-wide">
              Key Issues
            </h3>
            <ul className="space-y-2">
              {summary.keyIssues.map((issue: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-slate-300">
                  <span className="text-amber-400 mt-1">!</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">
            Quick Wins ({quickWins.length})
          </h2>
          <div className="grid gap-4">
            {quickWins.map((win: any, idx: number) => (
              <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-200">{win.title}</h3>
                  <div className="flex gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        win.impact === 'high'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : win.impact === 'medium'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                      }`}
                    >
                      {win.impact} impact
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      {win.estimatedEffort || win.expectedTimeline}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{win.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategic Initiatives */}
      {initiatives.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">
            Strategic Initiatives ({initiatives.length})
          </h2>
          <div className="grid gap-4">
            {initiatives.map((initiative: any, idx: number) => (
              <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-200">{initiative.title}</h3>
                  <div className="flex gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        initiative.priority === 'high'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                          : initiative.priority === 'medium'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
                      }`}
                    >
                      {initiative.priority} priority
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30">
                      {initiative.estimatedEffort || initiative.totalDuration}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-400">{initiative.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
