'use client';

// components/reports/renderers/LabReportRenderer.tsx
// Renderer for Lab diagnostic reports (Brand, Website, SEO, Content, etc.)

import { type ReportDetail } from '@/lib/reports/diagnosticReports';
import { isLabOutput, type LabOutput, type LabIssue } from '@/lib/diagnostics/contracts/labOutput';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  AlertCircle,
  TrendingUp,
  Target,
  Lightbulb,
  BarChart3,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface LabReportRendererProps {
  report: ReportDetail;
}

// ============================================================================
// Severity Badge Component
// ============================================================================

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { class: string; icon: React.ReactNode }> = {
    critical: {
      class: 'bg-red-600/20 text-red-400 border-red-600/30',
      icon: <AlertCircle className="w-3 h-3" />,
    },
    high: {
      class: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    medium: {
      class: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
      icon: <Info className="w-3 h-3" />,
    },
    low: {
      class: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
      icon: <Info className="w-3 h-3" />,
    },
  };

  const c = config[severity] || config.medium;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${c.class}`}
    >
      {c.icon}
      {severity}
    </span>
  );
}

// ============================================================================
// Score Strip Component
// ============================================================================

function ScoreStrip({ scores }: { scores: Record<string, number> }) {
  if (!scores || Object.keys(scores).length === 0) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Scores</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(scores).map(([key, value]) => (
          <div key={key} className="bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getScoreColor(value)} transition-all`}
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-white">
                {Math.round(value)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Dimensions Section Component
// ============================================================================

function DimensionsSection({ dimensions }: { dimensions: unknown[] }) {
  if (!dimensions || dimensions.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Dimensions</h3>
      </div>

      <div className="space-y-4">
        {dimensions.map((dim: any, idx) => (
          <div
            key={dim.key || idx}
            className="bg-slate-800/50 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white">
                {dim.label || dim.key || `Dimension ${idx + 1}`}
              </span>
              {dim.score !== undefined && (
                <span className="text-sm font-medium text-slate-300">
                  {Math.round(dim.score)}/100
                </span>
              )}
            </div>
            {dim.summary && (
              <p className="text-sm text-slate-400">{dim.summary}</p>
            )}
            {dim.status && (
              <span
                className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  dim.status === 'strong'
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : dim.status === 'moderate'
                    ? 'bg-amber-600/20 text-amber-400'
                    : 'bg-red-600/20 text-red-400'
                }`}
              >
                {dim.status}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Issues Section Component
// ============================================================================

function IssuesSection({ issues }: { issues: LabIssue[] | unknown[] }) {
  if (!issues || issues.length === 0) return null;

  // Group issues by severity
  const grouped = (issues as LabIssue[]).reduce((acc, issue) => {
    const severity = issue.severity || 'medium';
    if (!acc[severity]) acc[severity] = [];
    acc[severity].push(issue);
    return acc;
  }, {} as Record<string, LabIssue[]>);

  const severityOrder = ['critical', 'high', 'medium', 'low'];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-semibold text-white">Issues</h3>
        <span className="text-sm text-slate-500">({issues.length})</span>
      </div>

      <div className="space-y-6">
        {severityOrder.map((severity) => {
          const sevIssues = grouped[severity];
          if (!sevIssues || sevIssues.length === 0) return null;

          return (
            <div key={severity}>
              <div className="flex items-center gap-2 mb-3">
                <SeverityBadge severity={severity} />
                <span className="text-sm text-slate-500">
                  ({sevIssues.length})
                </span>
              </div>

              <div className="space-y-3">
                {sevIssues.map((issue, idx) => (
                  <div
                    key={issue.id || idx}
                    className="bg-slate-800/50 rounded-lg p-4"
                  >
                    <div className="font-medium text-white mb-1">
                      {issue.title}
                    </div>
                    {issue.description && (
                      <p className="text-sm text-slate-400">
                        {issue.description}
                      </p>
                    )}
                    {issue.evidence && issue.evidence.length > 0 && (
                      <div className="mt-2 text-xs text-slate-500">
                        <span className="font-medium">Evidence:</span>{' '}
                        {issue.evidence.slice(0, 3).join(', ')}
                        {issue.evidence.length > 3 && '...'}
                      </div>
                    )}
                    {issue.recommendedAction && (
                      <div className="mt-2 flex items-start gap-2 text-xs text-emerald-400">
                        <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{issue.recommendedAction}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Findings Section Component
// ============================================================================

function FindingsSection({ findings }: { findings: Record<string, unknown> }) {
  if (!findings || Object.keys(findings).length === 0) return null;

  // Filter out empty/null values and internal fields
  const displayFindings = Object.entries(findings).filter(([key, value]) => {
    if (key.startsWith('_')) return false;
    if (value === null || value === undefined) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && Object.keys(value as object).length === 0)
      return false;
    return true;
  });

  if (displayFindings.length === 0) return null;

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-emerald-400" />
        <h3 className="text-lg font-semibold text-white">Findings</h3>
      </div>

      <div className="space-y-4">
        {displayFindings.map(([key, value]) => (
          <div key={key} className="bg-slate-800/50 rounded-lg p-4">
            <div className="font-medium text-slate-300 mb-2 capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <FindingValue value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FindingValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <p className="text-sm text-slate-400">{value}</p>;
  }

  if (typeof value === 'number') {
    return <p className="text-sm text-white font-medium">{value}</p>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    // Check if array of strings
    if (typeof value[0] === 'string') {
      return (
        <ul className="list-disc list-inside space-y-1">
          {value.slice(0, 10).map((item, idx) => (
            <li key={idx} className="text-sm text-slate-400">
              {item}
            </li>
          ))}
          {value.length > 10 && (
            <li className="text-sm text-slate-500">
              ...and {value.length - 10} more
            </li>
          )}
        </ul>
      );
    }

    // Array of objects
    return (
      <div className="space-y-2">
        {value.slice(0, 5).map((item, idx) => (
          <div key={idx} className="text-sm text-slate-400 bg-slate-900/50 p-2 rounded">
            {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
          </div>
        ))}
        {value.length > 5 && (
          <div className="text-sm text-slate-500">...and {value.length - 5} more</div>
        )}
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <pre className="text-xs text-slate-400 overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <p className="text-sm text-slate-400">{String(value)}</p>;
}

// ============================================================================
// Main Lab Renderer Component
// ============================================================================

export function LabReportRenderer({ report }: LabReportRendererProps) {
  const data = report.data as Record<string, unknown>;

  // Try to detect if this follows the LabOutput contract
  const labOutput = isLabOutput(data) ? (data as LabOutput) : null;

  // Extract data from various possible structures
  const scores = labOutput?.scores || (data.scores as Record<string, number>) || null;
  const issues = labOutput?.issues || (data.issues as LabIssue[]) || [];
  const findings = labOutput?.findings || (data.findings as Record<string, unknown>) || null;
  const dimensions = (data.dimensions as unknown[]) || (labOutput?.dimensions as unknown[]) || [];
  const evidence = labOutput?.evidence || (data.evidence as Record<string, unknown>) || null;

  // Handle Brand Lab V2 structure
  const brandLabData = data as any;
  const brandDimensions = brandLabData?.dimensions || [];
  const brandIssues = brandLabData?.issues || [];
  const brandFindings = brandLabData?.findings || {};

  // Handle Website Lab structure
  const websiteLabData = data as any;
  const siteAssessment = websiteLabData?.siteAssessment || websiteLabData?.rawEvidence?.labResultV4?.siteAssessment;

  // Determine which data to render
  const hasLabOutputContract = labOutput !== null;
  const hasBrandLabStructure = brandDimensions.length > 0 || brandLabData?.maturityStage;
  const hasWebsiteLabStructure = siteAssessment !== null && siteAssessment !== undefined;

  return (
    <div>
      {/* Scores */}
      {scores && <ScoreStrip scores={scores} />}

      {/* Brand Lab specific rendering */}
      {hasBrandLabStructure && (
        <>
          {brandDimensions.length > 0 && <DimensionsSection dimensions={brandDimensions} />}
          {brandIssues.length > 0 && <IssuesSection issues={brandIssues} />}
          {Object.keys(brandFindings).length > 0 && <FindingsSection findings={brandFindings} />}
        </>
      )}

      {/* Website Lab specific rendering */}
      {hasWebsiteLabStructure && !hasBrandLabStructure && (
        <>
          {siteAssessment?.dimensions && <DimensionsSection dimensions={siteAssessment.dimensions} />}
          {siteAssessment?.issues && <IssuesSection issues={siteAssessment.issues} />}
          {siteAssessment?.criticalIssues && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Critical Issues</h3>
              </div>
              <ul className="space-y-2">
                {siteAssessment.criticalIssues.map((issue: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {siteAssessment?.quickWins && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">Quick Wins</h3>
              </div>
              <ul className="space-y-2">
                {siteAssessment.quickWins.map((win: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {win}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Generic LabOutput contract rendering */}
      {hasLabOutputContract && !hasBrandLabStructure && !hasWebsiteLabStructure && (
        <>
          {dimensions.length > 0 && <DimensionsSection dimensions={dimensions} />}
          {issues.length > 0 && <IssuesSection issues={issues} />}
          {findings && Object.keys(findings).length > 0 && <FindingsSection findings={findings} />}
        </>
      )}

      {/* Fallback: render any other structured data */}
      {!hasLabOutputContract && !hasBrandLabStructure && !hasWebsiteLabStructure && (
        <>
          {dimensions.length > 0 && <DimensionsSection dimensions={dimensions} />}
          {issues.length > 0 && <IssuesSection issues={issues} />}
          {findings && Object.keys(findings).length > 0 && <FindingsSection findings={findings} />}
        </>
      )}

      {/* If no structured data found, show basic info */}
      {!scores &&
        dimensions.length === 0 &&
        issues.length === 0 &&
        !findings &&
        !hasBrandLabStructure &&
        !hasWebsiteLabStructure && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-center">
            <p className="text-slate-400">
              No structured report data available. Check the raw JSON below for details.
            </p>
          </div>
        )}
    </div>
  );
}
