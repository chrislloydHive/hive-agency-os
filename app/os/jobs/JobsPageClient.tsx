'use client';

// app/os/jobs/JobsPageClient.tsx
// Jobs list page client component

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { JobRecord } from '@/lib/types/job';
import { JobStatusLabels, JobStatusColors } from '@/lib/types/job';
import { CreateJobModal } from '@/components/os/jobs/CreateJobModal';

interface EnrichedJob extends JobRecord {
  companyName: string;
}

interface EligibleCompany {
  id: string;
  name: string;
  clientCode: string;
  hasDriveFolder: boolean;
}

interface JobsPageClientProps {
  jobs: EnrichedJob[];
  companies: EligibleCompany[];
}

export function JobsPageClient({ jobs, companies }: JobsPageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [localJobs, setLocalJobs] = useState(jobs);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return localJobs.filter((job) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCode = job.jobCode.toLowerCase().includes(query);
        const matchesName = job.projectName.toLowerCase().includes(query);
        const matchesCompany = job.companyName.toLowerCase().includes(query);
        if (!matchesCode && !matchesName && !matchesCompany) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [localJobs, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: localJobs.length,
      ready: localJobs.filter((j) => j.status === 'ready').length,
      pending: localJobs.filter((j) => j.status === 'not_started' || j.status === 'provisioning').length,
      error: localJobs.filter((j) => j.status === 'error').length,
    };
  }, [localJobs]);

  const handleJobCreated = (newJob: EnrichedJob) => {
    setLocalJobs([newJob, ...localJobs]);
    setShowCreateModal(false);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Jobs</h1>
          <p className="text-slate-400 mt-1">
            Project intake and Google Drive provisioning
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Total Jobs</p>
          <p className="text-2xl font-semibold text-white">{stats.total}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Ready</p>
          <p className="text-2xl font-semibold text-green-400">{stats.ready}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Pending</p>
          <p className="text-2xl font-semibold text-amber-400">{stats.pending}</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <p className="text-slate-400 text-sm">Errors</p>
          <p className="text-2xl font-semibold text-red-400">{stats.error}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          <option value="all">All statuses</option>
          <option value="ready">Ready</option>
          <option value="not_started">Not Started</option>
          <option value="provisioning">Provisioning</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Jobs Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Job Code
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Project Name
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Client
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Drive
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {localJobs.length === 0 ? (
                    <div>
                      <p className="mb-2">No jobs yet</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        Create your first job
                      </button>
                    </div>
                  ) : (
                    'No jobs match your filters'
                  )}
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/os/jobs/${job.id}`}
                      className="font-mono font-medium text-amber-400 hover:text-amber-300"
                    >
                      {job.jobCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/os/jobs/${job.id}`}
                      className="text-white hover:text-slate-200"
                    >
                      {job.projectName}
                    </Link>
                    {job.projectType && (
                      <span className="ml-2 text-xs text-slate-500">
                        {job.projectType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{job.companyName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {job.dueDate ? formatDate(job.dueDate) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {job.driveJobFolderUrl ? (
                      <a
                        href={job.driveJobFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                        title="Open in Google Drive"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M7.71 3.5L1.15 15l4.58 6.5L12.29 10l-4.58-6.5zm8.58 0L9.73 15l4.58 6.5h6.54l-4.56-6.5 6.56-11.5h-6.56zM12 10L5.44 21.5h13.12L12 10z" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <CreateJobModal
          companies={companies}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleJobCreated}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = JobStatusColors[status as keyof typeof JobStatusColors] || JobStatusColors.not_started;
  const label = JobStatusLabels[status as keyof typeof JobStatusLabels] || status;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
      {status === 'provisioning' && (
        <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
