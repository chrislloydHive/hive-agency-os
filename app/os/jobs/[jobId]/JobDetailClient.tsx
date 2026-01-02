'use client';

// app/os/jobs/[jobId]/JobDetailClient.tsx
// Job detail page client component

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JobRecord } from '@/lib/types/job';
import { JobStatusLabels, JobStatusColors } from '@/lib/types/job';
import type { JobDocumentRecord } from '@/lib/types/template';
import { JobDocumentStatusLabels, JobDocumentStatusColors, DocumentTypeLabels } from '@/lib/types/template';

interface EnrichedJob extends JobRecord {
  companyName: string;
}

interface JobDetailClientProps {
  job: EnrichedJob;
  initialDocuments?: JobDocumentRecord[];
}

export function JobDetailClient({ job: initialJob, initialDocuments = [] }: JobDetailClientProps) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [documents, setDocuments] = useState<JobDocumentRecord[]>(initialDocuments);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isProvisioningDocs, setIsProvisioningDocs] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // Fetch documents on mount if job is ready
  useEffect(() => {
    if (job.status === 'ready' && initialDocuments.length === 0) {
      fetchDocuments();
    }
  }, [job.status]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/os/jobs/${job.id}/provision-docs`);
      const result = await response.json();
      if (result.ok) {
        setDocuments(result.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const handleProvisionDocs = async () => {
    setIsProvisioningDocs(true);

    try {
      const response = await fetch(`/api/os/jobs/${job.id}/provision-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();

      if (result.ok) {
        setDocuments((prev) => [...prev, ...(result.documents || [])]);
      }
    } catch (error) {
      console.error('Failed to provision documents:', error);
    } finally {
      setIsProvisioningDocs(false);
    }
  };

  const handleProvision = async () => {
    setIsProvisioning(true);
    setProvisionError(null);

    try {
      const response = await fetch(`/api/os/jobs/${job.id}/provision-drive`, {
        method: 'POST',
      });
      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Provisioning failed');
      }

      // Update local job state
      setJob({
        ...job,
        ...result.job,
        companyName: job.companyName,
      });

      // Refresh the page to get latest data
      router.refresh();
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setIsProvisioning(false);
    }
  };

  const showProvisionButton =
    job.status === 'not_started' || job.status === 'error';
  const isReady = job.status === 'ready';
  const hasError = job.status === 'error';

  return (
    <>
      {/* Back link */}
      <Link
        href="/os/jobs"
        className="inline-flex items-center gap-1 text-slate-400 hover:text-white mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Jobs
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white font-mono">{job.jobCode}</h1>
            <StatusBadge status={job.status} />
          </div>
          <h2 className="text-xl text-slate-300">{job.projectName}</h2>
          <p className="text-slate-400 mt-1">{job.companyName}</p>
        </div>

        {/* Primary action */}
        {isReady && job.driveJobFolderUrl && (
          <a
            href={job.driveJobFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.71 3.5L1.15 15l4.58 6.5L12.29 10l-4.58-6.5zm8.58 0L9.73 15l4.58 6.5h6.54l-4.56-6.5 6.56-11.5h-6.56zM12 10L5.44 21.5h13.12L12 10z" />
            </svg>
            Open in Drive
          </a>
        )}

        {showProvisionButton && (
          <button
            onClick={handleProvision}
            disabled={isProvisioning}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProvisioning ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Provisioning...
              </>
            ) : hasError ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retry Provisioning
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Provision Drive
              </>
            )}
          </button>
        )}
      </div>

      {/* Error banner */}
      {(hasError || provisionError) && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-400">Provisioning Error</p>
              <p className="text-sm text-slate-400 mt-1">
                {provisionError || job.driveProvisioningError || 'Unknown error'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Job Info Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Details Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Job Details
          </h3>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-slate-500">Job Number</dt>
              <dd className="text-white font-mono">{job.jobNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Job Code</dt>
              <dd className="text-white font-mono">{job.jobCode}</dd>
            </div>
            {job.projectType && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Type</dt>
                <dd className="text-white">{job.projectType}</dd>
              </div>
            )}
            {job.owner && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Owner</dt>
                <dd className="text-white">{job.owner}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Dates Card */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Dates
          </h3>
          <dl className="space-y-3">
            {job.startDate && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Start Date</dt>
                <dd className="text-white">{formatDate(job.startDate)}</dd>
              </div>
            )}
            {job.dueDate && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Due Date</dt>
                <dd className="text-white">{formatDate(job.dueDate)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-500">Created</dt>
              <dd className="text-white">{formatDate(job.createdAt)}</dd>
            </div>
            {job.driveProvisionedAt && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Provisioned</dt>
                <dd className="text-white">{formatDate(job.driveProvisionedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Drive Info */}
      {isReady && job.driveJobFolderId && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-8">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Google Drive
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-blue-500/10 rounded-lg">
              <svg className="w-8 h-8 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.71 3.5L1.15 15l4.58 6.5L12.29 10l-4.58-6.5zm8.58 0L9.73 15l4.58 6.5h6.54l-4.56-6.5 6.56-11.5h-6.56zM12 10L5.44 21.5h13.12L12 10z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">
                {job.jobCode} {job.projectName}
              </p>
              <p className="text-sm text-slate-400 truncate">
                Folder ID: {job.driveJobFolderId}
              </p>
            </div>
            <a
              href={job.driveJobFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
            >
              Open →
            </a>
          </div>

          {/* Subfolders info */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-2">Created subfolders:</p>
            <div className="flex flex-wrap gap-2">
              {['Timeline/Schedule', 'Estimate/Financials', 'Creative', 'Client Brief/Comms'].map((name) => (
                <span key={name} className="px-2 py-1 text-xs bg-slate-800 text-slate-400 rounded">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Documents Panel */}
      {isReady && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Documents
            </h3>
            {documents.length === 0 && (
              <button
                onClick={handleProvisionDocs}
                disabled={isProvisioningDocs}
                className="text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50"
              >
                {isProvisioningDocs ? 'Creating...' : '+ Create from templates'}
              </button>
            )}
          </div>

          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">
              No documents yet. Create documents from templates to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <DocumentTypeIcon documentType={doc.documentType} />
                    <div>
                      <p className="text-white font-medium">{doc.name}</p>
                      <p className="text-xs text-slate-400">
                        {DocumentTypeLabels[doc.documentType]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DocumentStatusBadge status={doc.status} />
                    <a
                      href={doc.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Open →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assignment */}
      {job.assignment && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Assignment / Notes
          </h3>
          <p className="text-slate-300 whitespace-pre-wrap">{job.assignment}</p>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = JobStatusColors[status as keyof typeof JobStatusColors] || JobStatusColors.not_started;
  const label = JobStatusLabels[status as keyof typeof JobStatusLabels] || status;

  return (
    <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${colors.bg} ${colors.text} ${colors.border} border`}>
      {status === 'provisioning' && (
        <svg className="w-4 h-4 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {label}
    </span>
  );
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
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

function DocumentTypeIcon({ documentType }: { documentType: string }) {
  // Google Docs icon for documents
  return (
    <div className="w-8 h-8 flex items-center justify-center bg-blue-500/10 rounded">
      <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
        <path d="M8 12h8v2H8zm0 4h8v2H8zm0-8h4v2H8z" />
      </svg>
    </div>
  );
}

function DocumentStatusBadge({ status }: { status: string }) {
  const colors = JobDocumentStatusColors[status as keyof typeof JobDocumentStatusColors] || JobDocumentStatusColors.draft;
  const label = JobDocumentStatusLabels[status as keyof typeof JobDocumentStatusLabels] || status;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}>
      {label}
    </span>
  );
}
