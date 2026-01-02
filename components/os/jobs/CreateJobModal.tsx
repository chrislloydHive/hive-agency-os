'use client';

// components/os/jobs/CreateJobModal.tsx
// Modal for creating a new job

import { useState, useEffect } from 'react';
import type { JobRecord, ProjectType } from '@/lib/types/job';
import { PROJECT_TYPES } from '@/lib/types/job';
import type { TemplatePackRecord } from '@/lib/types/template';

interface EnrichedJob extends JobRecord {
  companyName: string;
}

interface EligibleCompany {
  id: string;
  name: string;
  clientCode: string;
  hasDriveFolder: boolean;
}

interface CreateJobModalProps {
  companies: EligibleCompany[];
  templatePacks?: TemplatePackRecord[];
  onClose: () => void;
  onCreated: (job: EnrichedJob) => void;
}

export function CreateJobModal({ companies, templatePacks = [], onClose, onCreated }: CreateJobModalProps) {
  const [companyId, setCompanyId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [createDocuments, setCreateDocuments] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default template pack if available
  useEffect(() => {
    const defaultPack = templatePacks.find((p) => p.isDefault);
    if (defaultPack) {
      setSelectedPackId(defaultPack.id);
    } else if (templatePacks.length > 0) {
      setSelectedPackId(templatePacks[0].id);
    }
  }, [templatePacks]);

  const selectedCompany = companies.find((c) => c.id === companyId);
  const canSubmit = companyId && projectName.trim() && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the job
      const response = await fetch('/api/os/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          projectName: projectName.trim(),
          projectType: projectType || undefined,
          dueDate: dueDate || undefined,
        }),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || 'Failed to create job');
      }

      const jobId = result.job.id;

      // Trigger Drive provisioning
      try {
        const provisionResult = await fetch(`/api/os/jobs/${jobId}/provision-drive`, {
          method: 'POST',
        });
        const provisionData = await provisionResult.json();

        if (provisionData.ok) {
          // Update job with provisioned data
          result.job = provisionData.job || result.job;

          // If documents should be created and Drive is ready, provision documents
          if (createDocuments && provisionData.ok) {
            try {
              await fetch(`/api/os/jobs/${jobId}/provision-docs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  templatePackId: selectedPackId || undefined,
                }),
              });
            } catch (docErr) {
              console.warn('Failed to provision documents:', docErr);
              // Don't block job creation on document provisioning failure
            }
          }
        }
      } catch (err) {
        console.warn('Failed to trigger Drive provisioning:', err);
        // Don't block job creation on provisioning failure
      }

      onCreated(result.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Create Job</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Company Select */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Client <span className="text-red-400">*</span>
              </label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Select a client...</option>
                {companies.map((company) => (
                  <option
                    key={company.id}
                    value={company.id}
                    disabled={!company.hasDriveFolder}
                  >
                    {company.name} ({company.clientCode})
                    {!company.hasDriveFolder && ' - No Drive folder'}
                  </option>
                ))}
              </select>
              {selectedCompany && (
                <p className="mt-1 text-xs text-slate-500">
                  Job code will be: ###
                  {selectedCompany.clientCode}
                </p>
              )}
              {companies.length === 0 && (
                <p className="mt-1 text-xs text-amber-400">
                  No clients are configured for jobs. Set Client Code and Drive
                  Client Folder ID in Airtable.
                </p>
              )}
            </div>

            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                placeholder="e.g., Blog Development & Implementation"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Project Type (optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Project Type
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectType | '')}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Select type (optional)</option>
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date (optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Document Creation Options */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createDocuments}
                  onChange={(e) => setCreateDocuments(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500/50"
                />
                <span className="text-sm text-slate-300">
                  Create documents from templates
                </span>
              </label>

              {createDocuments && templatePacks.length > 0 && (
                <div className="mt-3 ml-7">
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Template Pack
                  </label>
                  <select
                    value={selectedPackId}
                    onChange={(e) => setSelectedPackId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    {templatePacks.map((pack) => (
                      <option key={pack.id} value={pack.id}>
                        {pack.name}
                        {pack.isDefault && ' (Default)'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    SOW, Brief, and Timeline will be created in the job folder
                  </p>
                </div>
              )}

              {createDocuments && templatePacks.length === 0 && (
                <p className="mt-2 ml-7 text-xs text-amber-400">
                  No template packs configured. Documents will not be created.
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Job'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
