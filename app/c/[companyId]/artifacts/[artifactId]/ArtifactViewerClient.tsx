'use client';

// app/c/[companyId]/artifacts/[artifactId]/ArtifactViewerClient.tsx
// Artifact Viewer Client Component
//
// Displays generated artifact content with:
// - Metadata header (type, status, created date)
// - Structured sections or markdown rendering
// - Regenerate action
// - Export to Google Drive action

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Presentation,
  Table,
  ExternalLink,
  RefreshCw,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Briefcase,
  Play,
  Link2,
  Zap,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { AttachArtifactToWorkModal } from '@/components/os/artifacts/AttachArtifactToWorkModal';
import { CreateWorkFromArtifactModal } from '@/components/os/artifacts/CreateWorkFromArtifactModal';
import { ArtifactFeedbackModule } from '@/components/os/artifacts/ArtifactFeedbackModule';
import { ArtifactUsageIndicators } from '@/components/os/artifacts/ArtifactUsageIndicators';
import type { Artifact } from '@/lib/types/artifact';
import { getArtifactTypeLabel, getArtifactStatusLabel, createDefaultUsage } from '@/lib/types/artifact';
import type { GeneratedArtifactOutput } from '@/lib/os/artifacts/registry';
import {
  deriveExecutionStatus,
  getExecutionStatusBadge,
  getExecutionCTA,
  getExecutionDescription,
  type ExecutionStatus,
} from '@/lib/os/artifacts/executionStatus';

// ============================================================================
// Types
// ============================================================================

interface ArtifactViewerClientProps {
  artifact: Artifact;
  companyId: string;
  companyName: string;
}

interface StructuredSection {
  id: string;
  title: string;
  content: string;
  items?: string[];
  subsections?: Array<{ title: string; content: string }>;
}

// ============================================================================
// Main Component
// ============================================================================

export function ArtifactViewerClient({
  artifact,
  companyId,
  companyName,
}: ArtifactViewerClientProps) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showCreateWorkModal, setShowCreateWorkModal] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus | null>(null);
  const [loadingExecutionStatus, setLoadingExecutionStatus] = useState(false);

  // Fetch execution status (work items created from this artifact)
  const fetchExecutionStatus = useCallback(async () => {
    if (!artifact.generatedContent && !artifact.generatedMarkdown) {
      // No content to convert
      return;
    }

    setLoadingExecutionStatus(true);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/artifacts/${artifact.id}/convert-to-work`
      );

      if (response.ok) {
        const data = await response.json();
        // Derive status from artifact usage and preview stats
        const status = deriveExecutionStatus(
          artifact.usage,
          data.stats?.total ?? null
        );
        setExecutionStatus(status);
      } else {
        // If preview fails, derive from usage alone
        setExecutionStatus(deriveExecutionStatus(artifact.usage, null));
      }
    } catch (err) {
      // Fall back to usage-based derivation
      setExecutionStatus(deriveExecutionStatus(artifact.usage, null));
    } finally {
      setLoadingExecutionStatus(false);
    }
  }, [companyId, artifact.id, artifact.usage, artifact.generatedContent, artifact.generatedMarkdown]);

  // Fetch execution status on mount and when modal closes (to refresh after creating work)
  useEffect(() => {
    fetchExecutionStatus();
  }, [fetchExecutionStatus]);

  // Refresh execution status when modal closes
  const handleCreateWorkModalClose = useCallback(() => {
    setShowCreateWorkModal(false);
    fetchExecutionStatus();
  }, [fetchExecutionStatus]);

  // Parse generated content
  const generatedContent = artifact.generatedContent as GeneratedArtifactOutput | null;
  const generatedMarkdown = artifact.generatedMarkdown;
  const format = artifact.generatedFormat;

  const hasContent = format && (generatedContent || generatedMarkdown);

  // Helper to extract sections from generated content
  const getSections = (): StructuredSection[] | null => {
    if (!generatedContent) return null;
    if ('sections' in generatedContent && Array.isArray(generatedContent.sections)) {
      return generatedContent.sections as StructuredSection[];
    }
    return null;
  };

  // Helper to extract content from hybrid/markdown formats
  const getHybridContent = (): string | null => {
    if (!generatedContent) return null;
    if ('content' in generatedContent && typeof generatedContent.content === 'string') {
      return generatedContent.content;
    }
    return null;
  };

  const sections = getSections();
  const hybridContent = getHybridContent();

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  // Expand all sections
  const expandAll = () => {
    if (sections) {
      setExpandedSections(new Set(sections.map((s: StructuredSection) => s.id)));
    }
  };

  // Collapse all sections
  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  // Regenerate artifact
  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/artifacts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactTypeId: artifact.type,
          source: {
            sourceType: 'strategy',
            sourceId: artifact.sourceStrategyId || companyId,
            includedTacticIds: artifact.includedTacticIds || undefined,
          },
          mode: 'refresh',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to regenerate artifact');
      }

      const data = await response.json();
      // Navigate to the new artifact
      router.push(`/c/${companyId}/artifacts/${data.artifact.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href={`/c/${companyId}/documents`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Documents
      </Link>

      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${getTypeIconStyle(artifact.type)}`}>
              {getTypeIcon(artifact.type)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{artifact.title}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-slate-400">
                  {getArtifactTypeLabel(artifact.type)}
                </span>
                <StatusBadge status={artifact.status} />
                {artifact.isStale && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                    Stale
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Google Drive Link */}
            {artifact.googleFileUrl && (
              <a
                href={artifact.googleFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Drive
              </a>
            )}

            {/* Attach to Work - visible for draft and final artifacts */}
            {artifact.status !== 'archived' && (
              <button
                onClick={() => setShowAttachModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
              >
                <Briefcase className="w-4 h-4" />
                Attach to Work
              </button>
            )}

            {/* Archived tooltip button */}
            {artifact.status === 'archived' && (
              <button
                disabled
                title="Archived artifacts cannot be attached to work items"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 text-slate-500 font-medium text-sm border border-slate-700/50 cursor-not-allowed"
              >
                <Briefcase className="w-4 h-4" />
                Attach to Work
              </button>
            )}

            {/* Regenerate */}
            {hasContent && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {regenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Regenerate
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {artifact.description && (
          <p className="mt-4 text-sm text-slate-400">{artifact.description}</p>
        )}

        {/* Metadata */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Created {new Date(artifact.createdAt).toLocaleDateString()}
            </span>
            {artifact.inputsUsedHash && (
              <span className="font-mono">
                Hash: {artifact.inputsUsedHash}
              </span>
            )}
          </div>
          {/* Usage Indicators */}
          <ArtifactUsageIndicators usage={artifact.usage ?? createDefaultUsage()} />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Execution Status Block */}
      {hasContent && (
        <ExecutionStatusBlock
          artifact={artifact}
          executionStatus={executionStatus}
          loading={loadingExecutionStatus}
          companyId={companyId}
          onAttachClick={() => setShowAttachModal(true)}
          onCreateWorkClick={() => setShowCreateWorkModal(true)}
          onViewWorkClick={() => router.push(`/c/${companyId}/work?artifactId=${artifact.id}`)}
        />
      )}

      {/* Content */}
      {hasContent ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          {/* Section Controls */}
          {format === 'structured' && sections && (
            <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <span className="text-xs text-slate-500">
                {sections.length} sections
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAll}
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Expand all
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={collapseAll}
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Collapse all
                </button>
              </div>
            </div>
          )}

          {/* Structured Content */}
          {format === 'structured' && sections && (
            <div className="divide-y divide-slate-800">
              {sections.map((section: StructuredSection) => (
                <Section
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              ))}
            </div>
          )}

          {/* Markdown Content */}
          {format === 'markdown' && generatedMarkdown && (
            <div className="p-6">
              <MarkdownRenderer content={generatedMarkdown} />
            </div>
          )}

          {/* Hybrid Content */}
          {format === 'hybrid' && generatedContent && (
            <div className="p-6">
              {/* Render markdown content if present */}
              {hybridContent && (
                <MarkdownRenderer content={hybridContent} />
              )}
              {/* Render sections if present */}
              {sections && sections.length > 0 && (
                <div className="mt-6 space-y-4">
                  {sections.map((section) => (
                    <Section
                      key={section.id}
                      section={section}
                      isExpanded={expandedSections.has(section.id)}
                      onToggle={() => toggleSection(section.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-400">No generated content</p>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            This artifact was created manually or its content is stored in Google Drive.
          </p>
          {artifact.googleFileUrl && (
            <a
              href={artifact.googleFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm transition-colors"
            >
              View in Google Drive
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* Included Tactics */}
      {artifact.includedTacticIds && artifact.includedTacticIds.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Included Tactics</h3>
          <div className="flex flex-wrap gap-2">
            {artifact.includedTacticIds.map(id => (
              <span
                key={id}
                className="px-2 py-1 text-xs font-mono bg-slate-800 text-slate-400 rounded"
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Module */}
      <ArtifactFeedbackModule
        companyId={companyId}
        artifactId={artifact.id}
        artifactStatus={artifact.status}
        existingFeedbackCount={artifact.feedback?.length ?? 0}
      />

      {/* Attach to Work Modal */}
      <AttachArtifactToWorkModal
        isOpen={showAttachModal}
        onClose={() => setShowAttachModal(false)}
        companyId={companyId}
        artifact={artifact}
      />

      {/* Create Work from Artifact Modal */}
      <CreateWorkFromArtifactModal
        isOpen={showCreateWorkModal}
        onClose={handleCreateWorkModalClose}
        companyId={companyId}
        artifact={artifact}
      />
    </div>
  );
}

// ============================================================================
// Execution Status Block Component
// ============================================================================

function ExecutionStatusBlock({
  artifact,
  executionStatus,
  loading,
  companyId,
  onAttachClick,
  onCreateWorkClick,
  onViewWorkClick,
}: {
  artifact: Artifact;
  executionStatus: ExecutionStatus | null;
  loading: boolean;
  companyId: string;
  onAttachClick: () => void;
  onCreateWorkClick: () => void;
  onViewWorkClick: () => void;
}) {
  const isArchived = artifact.status === 'archived';

  // Loading state
  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          <span className="text-sm text-slate-400">Checking execution status...</span>
        </div>
      </div>
    );
  }

  // No status yet - show basic CTA
  if (!executionStatus) {
    return (
      <div className="bg-gradient-to-r from-purple-900/30 to-slate-900/30 border border-purple-500/20 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Zap className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Execution</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Turn this artifact into actionable work items
              </p>
            </div>
          </div>
          {!isArchived && (
            <div className="flex items-center gap-2">
              <button
                onClick={onAttachClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
              >
                <Link2 className="w-4 h-4" />
                Attach to existing work...
              </button>
              <button
                onClick={onCreateWorkClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                Create work from artifact...
              </button>
            </div>
          )}
          {isArchived && (
            <span className="text-sm text-slate-500 italic">
              Archived artifacts cannot be converted to work
            </span>
          )}
        </div>
      </div>
    );
  }

  // Get badge and CTA config based on status
  const badge = getExecutionStatusBadge(executionStatus.state);
  const cta = getExecutionCTA(executionStatus.state, executionStatus.workItemsCreated);
  const description = getExecutionDescription(executionStatus);

  // Determine background gradient based on state
  const bgGradient = executionStatus.state === 'completed'
    ? 'from-emerald-900/30 to-slate-900/30 border-emerald-500/20'
    : executionStatus.state === 'in_progress'
    ? 'from-blue-900/30 to-slate-900/30 border-blue-500/20'
    : 'from-purple-900/30 to-slate-900/30 border-purple-500/20';

  return (
    <div className={`bg-gradient-to-r ${bgGradient} border rounded-xl p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            executionStatus.state === 'completed'
              ? 'bg-emerald-500/20'
              : executionStatus.state === 'in_progress'
              ? 'bg-blue-500/20'
              : 'bg-purple-500/20'
          }`}>
            {executionStatus.state === 'completed' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            ) : executionStatus.state === 'in_progress' ? (
              <Briefcase className="w-5 h-5 text-blue-400" />
            ) : (
              <Zap className="w-5 h-5 text-purple-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{description.title}</h3>
              {executionStatus.state !== 'not_started' && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded border ${badge.className}`}>
                  {executionStatus.workItemsCreated} work item{executionStatus.workItemsCreated !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {description.subtitle}
            </p>
          </div>
        </div>

        {/* CTAs based on state */}
        {!isArchived && (
          <div className="flex items-center gap-2">
            {/* Secondary CTA */}
            {cta.showSecondary && executionStatus.state === 'not_started' && (
              <button
                onClick={onAttachClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors border border-slate-700"
              >
                <Link2 className="w-4 h-4" />
                {cta.secondaryLabel}
              </button>
            )}

            {/* View work link for in_progress state */}
            {cta.showSecondary && executionStatus.state === 'in_progress' && (
              <button
                onClick={onViewWorkClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                {cta.secondaryLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Primary CTA */}
            {cta.primary.action === 'create' && (
              <button
                onClick={onCreateWorkClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                {cta.primary.label}
              </button>
            )}

            {cta.primary.action === 'continue' && (
              <button
                onClick={onCreateWorkClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                {cta.primary.label}
              </button>
            )}

            {cta.primary.action === 'view' && (
              <button
                onClick={onViewWorkClick}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                {cta.primary.label}
              </button>
            )}
          </div>
        )}

        {isArchived && (
          <span className="text-sm text-slate-500 italic">
            Archived artifacts cannot be converted to work
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Section Component
// ============================================================================

function Section({
  section,
  isExpanded,
  onToggle,
}: {
  section: StructuredSection;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyContent = async () => {
    const text = [
      section.title,
      section.content,
      section.items?.map(i => `- ${i}`).join('\n'),
      section.subsections?.map(s => `### ${s.title}\n${s.content}`).join('\n\n'),
    ].filter(Boolean).join('\n\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <h3 className="font-semibold text-slate-200">{section.title}</h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyContent();
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-slate-300 transition-all"
          title="Copy section"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 pl-12">
          {/* Main content */}
          <p className="text-sm text-slate-400 whitespace-pre-wrap">{section.content}</p>

          {/* Bullet items */}
          {section.items && section.items.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {section.items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-slate-600 mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          )}

          {/* Subsections */}
          {section.subsections && section.subsections.length > 0 && (
            <div className="mt-4 space-y-4">
              {section.subsections.map((sub, idx) => (
                <div key={idx} className="pl-4 border-l-2 border-slate-700">
                  <h4 className="text-sm font-medium text-slate-300 mb-1">{sub.title}</h4>
                  <p className="text-sm text-slate-400 whitespace-pre-wrap">{sub.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Markdown Renderer
// ============================================================================

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown-to-HTML conversion
  // For production, consider using a proper markdown library

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1 pl-4">
          {currentList.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
              <span className="text-slate-600 mt-1">•</span>
              {item}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, idx) => {
    // Headers
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={idx} className="text-lg font-semibold text-slate-200 mt-6 mb-2">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={idx} className="text-base font-semibold text-slate-300 mt-4 mb-2">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={idx} className="text-xl font-bold text-white mt-6 mb-3">
          {line.slice(2)}
        </h1>
      );
    }
    // Lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(line.slice(2));
    }
    // Empty lines
    else if (line.trim() === '') {
      flushList();
      elements.push(<div key={idx} className="h-2" />);
    }
    // Paragraphs
    else {
      flushList();
      elements.push(
        <p key={idx} className="text-sm text-slate-400 my-2">
          {line}
        </p>
      );
    }
  });

  flushList();

  return <div className="prose prose-invert prose-sm max-w-none">{elements}</div>;
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: Artifact['status'] }) {
  switch (status) {
    case 'final':
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
          <CheckCircle className="w-3 h-3" />
          {getArtifactStatusLabel(status)}
        </span>
      );
    case 'draft':
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded">
          {getArtifactStatusLabel(status)}
        </span>
      );
    case 'archived':
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-slate-600/10 text-slate-500 border border-slate-600/30 rounded">
          {getArtifactStatusLabel(status)}
        </span>
      );
    default:
      return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: Artifact['type']) {
  switch (type) {
    case 'qbr_slides':
    case 'proposal_slides':
      return <Presentation className="w-5 h-5" />;
    case 'media_plan':
    case 'pricing_sheet':
      return <Table className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
}

function getTypeIconStyle(type: Artifact['type']) {
  switch (type) {
    case 'strategy_doc':
    case 'strategy_summary':
      return 'bg-purple-500/10 text-purple-400';
    case 'rfp_response_doc':
      return 'bg-cyan-500/10 text-cyan-400';
    case 'qbr_slides':
    case 'proposal_slides':
      return 'bg-blue-500/10 text-blue-400';
    case 'media_plan':
    case 'pricing_sheet':
    case 'media_brief':
      return 'bg-green-500/10 text-green-400';
    case 'brief_doc':
    case 'creative_brief':
    case 'content_brief':
      return 'bg-amber-500/10 text-amber-400';
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

export default ArtifactViewerClient;
