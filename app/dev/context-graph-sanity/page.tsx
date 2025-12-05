// app/dev/context-graph-sanity/page.tsx
// Dev-only diagnostic page for Context Graph sanity checking
//
// This page displays a comprehensive report showing:
// - All Context Graph fields grouped by section
// - Writers and consumers for each field
// - Issues detected (mismatches, orphans, etc.)
// - Summary statistics
//
// Access: /dev/context-graph-sanity

import {
  collectGraphSanityReport,
  getHealthStatus,
  type GraphSanityReport,
  type FieldSanityReport,
  type DiagnosticIssue,
} from '@/lib/contextGraph/diagnostics';
import type { ContextSectionId } from '@/lib/contextGraph/schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================================================
// Server Component
// ============================================================================

export default function ContextGraphSanityPage() {
  // Generate report on server
  const report = collectGraphSanityReport();
  const healthStatus = getHealthStatus(report);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Context Graph Sanity Check
          </h1>
          <p className="text-slate-400">
            Schema, Writers, and Consumers diagnostic report
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Generated: {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>

        {/* Health Status */}
        <HealthStatusBadge status={healthStatus} />

        {/* Summary Stats */}
        <SummaryStats summary={report.summary} />

        {/* Quick Issues */}
        {report.summary.errorCount > 0 && (
          <IssuesPanel
            title="Errors"
            issues={report.allIssues.filter(i => i.severity === 'error')}
            severity="error"
          />
        )}

        {report.summary.warningCount > 0 && (
          <IssuesPanel
            title="Warnings"
            issues={report.allIssues.filter(i => i.severity === 'warning')}
            severity="warning"
          />
        )}

        {/* Fields by Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Fields by Section
          </h2>
          {Object.entries(report.fieldsBySection).map(([section, fields]) => (
            <SectionPanel
              key={section}
              section={section as ContextSectionId}
              fields={fields}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Components
// ============================================================================

function HealthStatusBadge({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) {
  const colors = {
    healthy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    degraded: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    unhealthy: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const labels = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    unhealthy: 'Unhealthy',
  };

  return (
    <div className={`inline-flex items-center px-4 py-2 rounded-full border ${colors[status]} mb-6`}>
      <span className="w-2 h-2 rounded-full mr-2" style={{
        backgroundColor: status === 'healthy' ? '#10b981' : status === 'degraded' ? '#f59e0b' : '#ef4444'
      }} />
      <span className="font-medium">{labels[status]}</span>
    </div>
  );
}

function SummaryStats({ summary }: { summary: GraphSanityReport['summary'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
      <StatCard label="Total Fields" value={summary.totalFields} />
      <StatCard
        label="Fields with Issues"
        value={summary.fieldsWithIssues}
        highlight={summary.fieldsWithIssues > 0 ? 'warning' : undefined}
      />
      <StatCard
        label="Critical Issues"
        value={summary.criticalFieldsWithIssues}
        highlight={summary.criticalFieldsWithIssues > 0 ? 'error' : undefined}
      />
      <StatCard
        label="Errors"
        value={summary.errorCount}
        highlight={summary.errorCount > 0 ? 'error' : undefined}
      />
      <StatCard
        label="Warnings"
        value={summary.warningCount}
        highlight={summary.warningCount > 0 ? 'warning' : undefined}
      />
      <StatCard label="Info" value={summary.infoCount} />
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: 'error' | 'warning';
}) {
  const bgColor = highlight === 'error'
    ? 'bg-red-500/10 border-red-500/30'
    : highlight === 'warning'
    ? 'bg-amber-500/10 border-amber-500/30'
    : 'bg-slate-800/50 border-slate-700/50';

  const textColor = highlight === 'error'
    ? 'text-red-400'
    : highlight === 'warning'
    ? 'text-amber-400'
    : 'text-white';

  return (
    <div className={`p-4 rounded-lg border ${bgColor}`}>
      <div className={`text-2xl font-bold ${textColor}`}>{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function IssuesPanel({
  title,
  issues,
  severity,
}: {
  title: string;
  issues: DiagnosticIssue[];
  severity: 'error' | 'warning';
}) {
  const colors = {
    error: 'border-red-500/30 bg-red-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
  };

  const textColors = {
    error: 'text-red-400',
    warning: 'text-amber-400',
  };

  return (
    <div className={`mb-6 p-4 rounded-lg border ${colors[severity]}`}>
      <h3 className={`font-semibold mb-3 ${textColors[severity]}`}>
        {title} ({issues.length})
      </h3>
      <div className="space-y-2">
        {issues.slice(0, 20).map((issue, idx) => (
          <div key={idx} className="text-sm">
            <code className="text-slate-300 bg-slate-800 px-1 rounded">
              {issue.path}
            </code>
            <span className="text-slate-400 ml-2">{issue.message}</span>
            {issue.suggestion && (
              <div className="text-xs text-slate-500 ml-4 mt-1">
                {issue.suggestion}
              </div>
            )}
          </div>
        ))}
        {issues.length > 20 && (
          <div className="text-xs text-slate-500">
            ... and {issues.length - 20} more
          </div>
        )}
      </div>
    </div>
  );
}

function SectionPanel({
  section,
  fields,
}: {
  section: ContextSectionId;
  fields: FieldSanityReport[];
}) {
  const hasIssues = fields.some(f => f.issues.length > 0);

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <span className="capitalize">{section}</span>
        <span className="text-xs text-slate-500">({fields.length} fields)</span>
        {hasIssues && (
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
            Has issues
          </span>
        )}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700">
              <th className="py-2 px-3 font-medium">Path</th>
              <th className="py-2 px-3 font-medium">Label</th>
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium">Primary Sources</th>
              <th className="py-2 px-3 font-medium">Writers</th>
              <th className="py-2 px-3 font-medium">Consumers</th>
              <th className="py-2 px-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <FieldRow key={field.path} field={field} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FieldRow({ field }: { field: FieldSanityReport }) {
  const hasErrors = field.issues.some(i => i.severity === 'error');
  const hasWarnings = field.issues.some(i => i.severity === 'warning');

  const rowBg = hasErrors
    ? 'bg-red-500/5'
    : hasWarnings
    ? 'bg-amber-500/5'
    : '';

  return (
    <tr className={`border-b border-slate-800/50 hover:bg-slate-800/30 ${rowBg}`}>
      <td className="py-2 px-3">
        <code className="text-xs text-slate-300">{field.path}</code>
        {field.critical && (
          <span className="ml-1 text-xs text-amber-400" title="Critical field">*</span>
        )}
        {field.deprecated && (
          <span className="ml-1 text-xs text-slate-500" title="Deprecated">(deprecated)</span>
        )}
      </td>
      <td className="py-2 px-3 text-slate-400">{field.label}</td>
      <td className="py-2 px-3">
        <code className="text-xs text-slate-500">{field.type}</code>
      </td>
      <td className="py-2 px-3">
        <div className="flex flex-wrap gap-1">
          {field.primarySources.map(s => (
            <span
              key={s}
              className={`text-xs px-1.5 py-0.5 rounded ${
                field.writers.includes(s)
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </td>
      <td className="py-2 px-3">
        <div className="flex flex-wrap gap-1">
          {field.writers.length > 0 ? (
            field.writers.map(w => (
              <span
                key={w}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  field.primarySources.includes(w)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {w}
              </span>
            ))
          ) : (
            <span className="text-xs text-red-400">None</span>
          )}
        </div>
      </td>
      <td className="py-2 px-3">
        <div className="flex flex-wrap gap-1">
          {field.consumers.length > 0 ? (
            field.consumers.map(c => (
              <span
                key={c}
                className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400"
              >
                {c}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-500">None</span>
          )}
        </div>
      </td>
      <td className="py-2 px-3">
        {field.issues.length === 0 ? (
          <span className="text-xs text-emerald-400">OK</span>
        ) : (
          <div className="flex flex-col gap-1">
            {field.issues.map((issue, idx) => (
              <span
                key={idx}
                className={`text-xs ${
                  issue.severity === 'error'
                    ? 'text-red-400'
                    : issue.severity === 'warning'
                    ? 'text-amber-400'
                    : 'text-slate-400'
                }`}
                title={issue.suggestion || issue.message}
              >
                {issue.type.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
