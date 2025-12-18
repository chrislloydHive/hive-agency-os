'use client';

// app/c/[companyId]/projects/[projectId]/brief/BriefPageClient.tsx
// Creative Brief view and editing client component

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Lock,
  RefreshCw,
  Briefcase,
} from 'lucide-react';
import type { CreativeBrief } from '@/lib/types/creativeBrief';
import type { Project } from '@/lib/types/project';
import { PROJECT_TYPE_LABELS } from '@/lib/types/project';
import { BRIEF_STATUS_LABELS, BRIEF_STATUS_COLORS } from '@/lib/types/creativeBrief';

interface BriefPageClientProps {
  companyId: string;
  projectId: string;
}

export function BriefPageClient({ companyId, projectId }: BriefPageClientProps) {
  const router = useRouter();
  const [brief, setBrief] = useState<CreativeBrief | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [generatingWork, setGeneratingWork] = useState(false);

  // Fetch brief and project
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/projects/${projectId}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch project');
        }

        setProject(data.project);
        setBrief(data.brief);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [companyId, projectId]);

  const handleApprove = async () => {
    if (!brief) return;

    setApproving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/projects/${projectId}/brief/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefId: brief.id }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve brief');
      }

      setBrief(data.brief);
      setProject(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve brief');
    } finally {
      setApproving(false);
    }
  };

  const handleGenerateWork = async () => {
    if (!brief || brief.status !== 'approved') return;

    setGeneratingWork(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/projects/${projectId}/work/from-brief`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate work');
      }

      // Navigate to work items
      router.push(`/c/${companyId}/work`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate work');
      setGeneratingWork(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error || 'Project not found'}
          </div>
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700 text-center">
            <p className="text-slate-400 mb-4">
              No creative brief has been generated yet.
            </p>
            <Link
              href={`/c/${companyId}/projects/${projectId}/strategy`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to Strategy
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isApproved = brief.status === 'approved';
  const content = brief.content;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Link
              href={`/c/${companyId}/projects/${projectId}/strategy`}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-white">
                  {brief.title}
                </h1>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${BRIEF_STATUS_COLORS[brief.status]}`}
                >
                  {BRIEF_STATUS_LABELS[brief.status]}
                </span>
                {brief.isLocked && (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                )}
              </div>
              <p className="text-sm text-slate-400">
                {PROJECT_TYPE_LABELS[project.type]} Creative Brief
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {!isApproved ? (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {approving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Approve Brief
              </button>
            ) : (
              <button
                onClick={handleGenerateWork}
                disabled={generatingWork}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generatingWork ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Briefcase className="w-4 h-4" />
                )}
                Create Work from Brief
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Brief Content */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Strategic Context */}
          <BriefSection title="Strategic Context">
            <BriefField label="Objective" value={content.objective} />
            <BriefField
              label="Primary Audience"
              value={content.primaryAudience}
            />
            {content.audienceInsights && (
              <BriefField
                label="Audience Insights"
                value={content.audienceInsights}
              />
            )}
          </BriefSection>

          {/* Message */}
          <BriefSection title="Message">
            <BriefField
              label="Single-Minded Message"
              value={content.singleMindedMessage}
              highlight
            />
            <BriefField
              label="Supporting Points"
              value={content.supportingPoints?.join('\n• ') || ''}
              prefix="• "
            />
            {content.proofPoints && content.proofPoints.length > 0 && (
              <BriefField
                label="Proof Points"
                value={content.proofPoints.join('\n• ')}
                prefix="• "
              />
            )}
          </BriefSection>

          {/* Brand */}
          <BriefSection title="Brand">
            <BriefField label="Brand Voice" value={content.brandVoice} />
            {content.offer && (
              <BriefField label="Offer" value={content.offer} />
            )}
          </BriefSection>

          {/* Requirements */}
          <BriefSection title="Requirements">
            <BriefField
              label="Mandatories"
              value={content.mandatories?.join('\n• ') || ''}
              prefix="• "
            />
            <BriefField
              label="Constraints"
              value={content.constraints?.join('\n• ') || ''}
              prefix="• "
            />
          </BriefSection>

          {/* Success */}
          <BriefSection title="Success Definition">
            <BriefField
              label="How We Know It Worked"
              value={content.successDefinition}
            />
          </BriefSection>

          {/* Print Ad Specific */}
          {content.projectType === 'print_ad' && (
            <>
              <BriefSection title="Format Specifications">
                <div className="grid grid-cols-2 gap-4">
                  <BriefField
                    label="Size"
                    value={(content as { formatSpecs?: { size?: string } }).formatSpecs?.size || ''}
                  />
                  <BriefField
                    label="Dimensions"
                    value={(content as { formatSpecs?: { dimensions?: string } }).formatSpecs?.dimensions || ''}
                  />
                  <BriefField
                    label="Color Mode"
                    value={(content as { formatSpecs?: { colorMode?: string } }).formatSpecs?.colorMode || ''}
                  />
                  <BriefField
                    label="Publication"
                    value={(content as { publication?: string }).publication || ''}
                  />
                </div>
              </BriefSection>

              <BriefSection title="Creative Direction">
                <BriefField
                  label="Call to Action"
                  value={(content as { cta?: string }).cta || ''}
                  highlight
                />
                <BriefField
                  label="Visual Direction"
                  value={(content as { visualDirection?: string }).visualDirection || ''}
                />
                <BriefField
                  label="Copy Tone"
                  value={(content as { copyTone?: string }).copyTone || ''}
                />
                {(content as { headlineOptions?: string[] }).headlineOptions && (
                  <BriefField
                    label="Headline Options"
                    value={(content as { headlineOptions?: string[] }).headlineOptions?.join('\n• ') || ''}
                    prefix="• "
                  />
                )}
              </BriefSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper components
function BriefSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
      <h3 className="text-sm font-medium text-slate-300 mb-4 pb-2 border-b border-slate-700/50">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function BriefField({
  label,
  value,
  highlight = false,
  prefix = '',
}: {
  label: string;
  value: string;
  highlight?: boolean;
  prefix?: string;
}) {
  if (!value) return null;

  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div
        className={`text-sm ${
          highlight
            ? 'p-3 bg-purple-500/10 border border-purple-500/30 rounded text-purple-200 font-medium'
            : 'text-slate-300'
        }`}
      >
        {prefix && !highlight ? prefix : ''}
        {value}
      </div>
    </div>
  );
}

export default BriefPageClient;
