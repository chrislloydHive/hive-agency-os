// app/c/[companyId]/brain/history/page.tsx
// Brain History - Timeline of changes and activity
//
// Part of the 3-tab Brain structure:
// - Context: Field-level editor for company data
// - Insights: AI-generated analysis and patterns
// - History (this): Timeline of changes, updates, and events

import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getSnapshotMetaForCompany, type SnapshotMeta } from '@/lib/contextGraph/snapshots';
import { CompanyActivityTimeline } from '@/components/os/CompanyActivityTimeline';
import { History, GitBranch, Clock, ArrowRight, FileText, Zap, User, Database } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PageProps {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Brain - History',
};

// ============================================================================
// Page Component
// ============================================================================

export default async function BrainHistoryPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company info
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  // Load context graph and snapshots
  const graph = await loadContextGraph(companyId);
  const snapshots = await getSnapshotMetaForCompany(companyId, 50);

  // If no graph exists yet
  if (!graph) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6">
              <History className="w-8 h-8 text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-200 mb-2">No History Yet</h2>
            <p className="text-sm text-slate-400">
              Build your company's context graph to start tracking changes over time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-200">History</h1>
        <p className="text-sm text-slate-500 mt-1">
          Timeline of changes, diagnostic runs, and context evolution
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Snapshots"
          value={snapshots.length.toString()}
          icon={<GitBranch className="w-4 h-4" />}
        />
        <StatCard
          label="Latest Update"
          value={graph.meta.updatedAt
            ? formatRelativeTime(graph.meta.updatedAt)
            : 'Never'}
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="Version"
          value={graph.meta.version?.toString() ?? '1'}
          icon={<History className="w-4 h-4" />}
        />
      </div>

      {/* Two Column Layout: Activity + Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Timeline */}
        <div>
          <CompanyActivityTimeline companyId={companyId} limit={15} />
        </div>

        {/* Snapshots Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-200">Snapshots</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track how company context evolves over time
          </p>
        </div>

        {snapshots.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
              <Database className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400">No snapshots recorded yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Snapshots are created when QBRs run, SSM completes, or you create manual checkpoints.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50">
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Created At</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {snapshots.map((snapshot, index) => (
                  <SnapshotRow
                    key={snapshot.id}
                    snapshot={snapshot}
                    companyId={companyId}
                    isLatest={index === 0}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

// ============================================================================
// Snapshot Row Component
// ============================================================================

function SnapshotRow({
  snapshot,
  companyId,
  isLatest,
}: {
  snapshot: SnapshotMeta;
  companyId: string;
  isLatest: boolean;
}) {
  return (
    <tr className="hover:bg-slate-800/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-200">{snapshot.label}</span>
          {isLatest && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300">
              Latest
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <SnapshotTypeBadge type={snapshot.type} />
      </td>
      <td className="px-4 py-3 text-slate-400">
        {formatDate(snapshot.createdAt)}
      </td>
      <td className="px-4 py-3">
        {snapshot.sourceRunId ? (
          <span className="text-xs text-slate-500 font-mono">
            {snapshot.sourceRunId.slice(0, 12)}...
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Show "View Strategy" for QBR/SSM snapshots */}
          {(snapshot.type === 'qbr' || snapshot.type === 'ssm') && (
            <Link
              href={`/c/${companyId}/qbr/strategic-plan?snapshotId=${snapshot.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-300 bg-blue-500/20 hover:bg-blue-500/30 transition-colors"
            >
              View Strategy
            </Link>
          )}
          <Link
            href={`/c/${companyId}/brain/context?snapshotId=${snapshot.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            View Context
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// Snapshot Type Badge Component
// ============================================================================

function SnapshotTypeBadge({ type }: { type: SnapshotMeta['type'] }) {
  const config: Record<SnapshotMeta['type'], { icon: React.ReactNode; label: string; className: string }> = {
    qbr: {
      icon: <FileText className="w-3 h-3" />,
      label: 'QBR',
      className: 'bg-blue-500/20 text-blue-300',
    },
    ssm: {
      icon: <Zap className="w-3 h-3" />,
      label: 'SSM',
      className: 'bg-purple-500/20 text-purple-300',
    },
    manual: {
      icon: <User className="w-3 h-3" />,
      label: 'Manual',
      className: 'bg-slate-500/20 text-slate-300',
    },
    lab: {
      icon: <Database className="w-3 h-3" />,
      label: 'Lab',
      className: 'bg-green-500/20 text-green-300',
    },
    import: {
      icon: <Database className="w-3 h-3" />,
      label: 'Import',
      className: 'bg-amber-500/20 text-amber-300',
    },
    migration: {
      icon: <GitBranch className="w-3 h-3" />,
      label: 'Migration',
      className: 'bg-red-500/20 text-red-300',
    },
  };

  const { icon, label, className } = config[type] || config.manual;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center gap-2 text-slate-500 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-lg font-semibold text-slate-200">{value}</div>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}
