'use client';

// app/c/[companyId]/artifacts/ArtifactsClient.tsx
// Artifacts Client Component - Output ledger for all generated artifacts
//
// Information Architecture:
// - Section 1: Generated Artifacts (table/list view)
// - Section 2: Create New Artifact (template action cards)
// - Section 3: Template Library (collapsible, advanced)
//
// DATA SOURCE: CompanyArtifactIndex (canonical) + Artifacts table (legacy)

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Presentation,
  Table,
  ExternalLink,
  CheckCircle,
  Archive,
  PencilLine,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  Filter,
  FileSearch,
  FolderOpen,
  AlertTriangle,
  Sparkles,
  Clock,
  Bot,
  User,
  Users,
} from 'lucide-react';
import type { Artifact, ArtifactType, ArtifactStatus } from '@/lib/types/artifact';
import { getArtifactTypeLabel, getArtifactStatusLabel, createDefaultUsage } from '@/lib/types/artifact';
import type { CompanyArtifactIndex, ArtifactPhase } from '@/lib/types/artifactIndex';
import { ArtifactUsageBadge } from '@/components/os/artifacts/ArtifactUsageIndicators';
import { getArtifactViewerHref } from '@/lib/os/artifacts/navigation';
import type { TemplateRecord } from '@/lib/types/template';
import { DocumentTypeLabels } from '@/lib/types/template';
import { ArtifactProvenance, getProvenanceLabel } from '@/lib/types/artifactTaxonomy';

// ============================================================================
// Types
// ============================================================================

interface ArtifactsClientProps {
  companyId: string;
  companyName: string;
  initialArtifacts: Artifact[];
  initialIndexedArtifacts: CompanyArtifactIndex[];
  templates: TemplateRecord[];
  msaDriveUrl?: string;
  hasDriveFolder: boolean;
}

type FilterStatus = 'all' | 'active' | ArtifactStatus;
type FilterPhase = 'all' | ArtifactPhase;

// ============================================================================
// Template Card Icons
// ============================================================================

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  SOW: <FileText className="w-5 h-5" />,
  BRIEF: <FileSearch className="w-5 h-5" />,
  TIMELINE: <Clock className="w-5 h-5" />,
  MSA: <FileText className="w-5 h-5" />,
  default: <FileText className="w-5 h-5" />,
};

const TEMPLATE_COLORS: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  SOW: { bg: 'bg-purple-500/5', border: 'border-purple-500/30', text: 'text-purple-400', iconBg: 'bg-purple-500/20' },
  BRIEF: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/30', text: 'text-cyan-400', iconBg: 'bg-cyan-500/20' },
  TIMELINE: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-400', iconBg: 'bg-amber-500/20' },
  MSA: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-400', iconBg: 'bg-emerald-500/20' },
  default: { bg: 'bg-slate-500/5', border: 'border-slate-500/30', text: 'text-slate-400', iconBg: 'bg-slate-500/20' },
};

// ============================================================================
// Main Component
// ============================================================================

export function ArtifactsClient({
  companyId,
  companyName,
  initialArtifacts,
  initialIndexedArtifacts,
  templates,
  msaDriveUrl,
  hasDriveFolder,
}: ArtifactsClientProps) {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialArtifacts);
  const [indexedArtifacts, setIndexedArtifacts] = useState<CompanyArtifactIndex[]>(initialIndexedArtifacts);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('active');
  const [filterPhase, setFilterPhase] = useState<FilterPhase>('all');
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [instantiating, setInstantiating] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [driveReady, setDriveReady] = useState(hasDriveFolder);
  const [programName, setProgramName] = useState('');
  const [creatingProgram, setCreatingProgram] = useState(false);
  const [forceProvision, setForceProvision] = useState(false);

  // Merge and dedupe artifacts from both sources
  const allArtifacts = mergeArtifactSources(artifacts, indexedArtifacts);
  const filteredArtifacts = applyFilters(allArtifacts, filterStatus, filterPhase);
  const isEmpty = allArtifacts.length === 0;

  // Refresh artifacts
  const refreshArtifacts = useCallback(async () => {
    setLoading(true);
    try {
      const [artifactsRes, indexedRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/artifacts`),
        fetch(`/api/os/companies/${companyId}/artifact-index?flat=true`),
      ]);

      if (artifactsRes.ok) {
        const data = await artifactsRes.json();
        setArtifacts(data.artifacts || []);
      }

      if (indexedRes.ok) {
        const data = await indexedRes.json();
        setIndexedArtifacts(data.artifacts || []);
      }
    } catch (err) {
      console.error('[ArtifactsClient] Refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Provision Drive folders for this company
  const handleProvisionDrive = async () => {
    setProvisioning(true);
    try {
      const res = await fetch(`/api/os/companies/${companyId}/provision-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'initialize', force: forceProvision }),
      });

      if (res.ok) {
        const data = await res.json();
        setDriveReady(true);
        alert('Drive folders provisioned successfully!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to provision Drive folders');
      }
    } catch (err) {
      console.error('[ArtifactsClient] Provision error:', err);
      alert('Failed to provision Drive folders');
    } finally {
      setProvisioning(false);
    }
  };

  const handleUpgradeDrive = async () => {
    setUpgrading(true);
    try {
      const res = await fetch(`/api/os/companies/${companyId}/provision-drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'upgrade' }),
      });

      if (res.ok) {
        setDriveReady(true);
        alert('Drive structure upgraded/verified successfully.');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to upgrade Drive structure');
      }
    } catch (err) {
      console.error('[ArtifactsClient] Upgrade error:', err);
      alert('Failed to upgrade Drive structure');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCreateProgramFolder = async () => {
    if (!programName.trim()) {
      alert('Enter a program name');
      return;
    }
    setCreatingProgram(true);
    try {
      const res = await fetch(`/api/os/companies/${companyId}/drive/programs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programName: programName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Program folder created: ${data.programFolderUrl || data.programFolderId}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create program folder');
      }
    } catch (err) {
      console.error('[ArtifactsClient] Program folder error:', err);
      alert('Failed to create program folder');
    } finally {
      setCreatingProgram(false);
    }
  };

  // Instantiate template
  const handleInstantiateTemplate = async (template: TemplateRecord) => {
    if (!driveReady) {
      alert('Please provision Drive folders for this company first.');
      return;
    }

    setInstantiating(template.id);
    try {
      const res = await fetch(`/api/os/companies/${companyId}/artifacts/instantiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id }),
      });

      if (res.ok) {
        const data = await res.json();
        // Refresh to show new artifact
        await refreshArtifacts();
        // Open the new artifact
        if (data.artifact?.url) {
          window.open(data.artifact.url, '_blank');
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create artifact');
      }
    } catch (err) {
      console.error('[ArtifactsClient] Instantiate error:', err);
      alert('Failed to create artifact');
    } finally {
      setInstantiating(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Artifacts</h1>
          <p className="text-sm text-slate-400 mt-1">
            All generated outputs for {companyName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {msaDriveUrl && (
            <a
              href={msaDriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Open Drive
            </a>
          )}
          <button
            onClick={refreshArtifacts}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* Section 2: Create New Artifact (Primary) */}
      {/* ================================================================== */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Create New Artifact
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {templates.slice(0, 4).map(template => {
            const colors = TEMPLATE_COLORS[template.documentType] || TEMPLATE_COLORS.default;
            const icon = TEMPLATE_ICONS[template.documentType] || TEMPLATE_ICONS.default;
            const isLoading = instantiating === template.id;

            return (
              <button
                key={template.id}
                onClick={() => handleInstantiateTemplate(template)}
                disabled={isLoading || !driveReady}
                className={`${colors.bg} ${colors.border} border rounded-xl p-4 text-left hover:border-opacity-60 transition-all disabled:opacity-50 disabled:cursor-not-allowed group`}
              >
                <div className={`${colors.iconBg} ${colors.text} p-2.5 rounded-lg inline-block mb-3`}>
                  {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : icon}
                </div>
                <h3 className="font-medium text-white mb-1">{template.name}</h3>
                <p className="text-xs text-slate-500">
                  {DocumentTypeLabels[template.documentType] || template.documentType}
                </p>
                {template.allowAIDrafting && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-purple-400">
                    <Sparkles className="w-3 h-3" />
                    AI-assisted
                  </div>
                )}
              </button>
            );
          })}

          {/* Custom Artifact Card */}
          <Link
            href={`/c/${companyId}/deliver`}
            className="bg-slate-800/30 border border-slate-700 border-dashed rounded-xl p-4 text-left hover:border-slate-600 transition-all group"
          >
            <div className="bg-slate-700/50 text-slate-400 p-2.5 rounded-lg inline-block mb-3 group-hover:bg-slate-700">
              <Plus className="w-5 h-5" />
            </div>
            <h3 className="font-medium text-slate-300 mb-1">Custom Artifact</h3>
            <p className="text-xs text-slate-500">Create from scratch</p>
          </Link>
        </div>

        {!driveReady && (
          <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Drive folders not provisioned for this company
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Provision Google Drive folders to enable template creation.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  className="rounded border-slate-600 bg-slate-900"
                  checked={forceProvision}
                  onChange={(e) => setForceProvision(e.target.checked)}
                />
                Force provision (override eligibility)
              </label>
              <button
                onClick={handleProvisionDrive}
                disabled={provisioning}
                className="px-4 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {provisioning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3.5 h-3.5" />
                    Provision Drive Folders
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {driveReady && (
          <div className="mt-3 p-3 bg-slate-800/60 border border-slate-700 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Drive is ready</span>
              <button
                onClick={handleUpgradeDrive}
                disabled={upgrading}
                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {upgrading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FolderOpen className="w-3.5 h-3.5" />}
                {upgrading ? 'Upgrading...' : 'Upgrade/Verify Structure'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="Program name (e.g., Q2 Campaign)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <button
                onClick={handleCreateProgramFolder}
                disabled={creatingProgram}
                className="px-4 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {creatingProgram ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3.5 h-3.5" />
                    Create Program Folder
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/* Section 1: Generated Artifacts */}
      {/* ================================================================== */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Generated Artifacts
            <span className="ml-2 text-slate-500 font-normal lowercase">
              ({filteredArtifacts.length})
            </span>
          </h2>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="active">Active</option>
              <option value="all">All statuses</option>
              <option value="draft">Draft only</option>
              <option value="final">Final only</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value as FilterPhase)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="all">All phases</option>
              <option value="Discover">Discover</option>
              <option value="Decide">Decide</option>
              <option value="Deliver">Deliver</option>
              <option value="Work">Work</option>
              <option value="Report">Report</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {isEmpty && (
          <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-12 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-400">No artifacts yet</p>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              Run diagnostics or create a document from a template above.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href={`/c/${companyId}/discover`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold text-sm transition-colors"
              >
                Run Diagnostics
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Artifact List */}
        {!isEmpty && (
          <div className="space-y-2">
            {filteredArtifacts.map(artifact => (
              <ArtifactRow
                key={artifact.id}
                artifact={artifact}
                companyId={companyId}
              />
            ))}
          </div>
        )}
      </section>

      {/* ================================================================== */}
      {/* Section 3: Template Library (Collapsible) */}
      {/* ================================================================== */}
      {templates.length > 4 && (
        <section>
          <button
            onClick={() => setShowTemplateLibrary(!showTemplateLibrary)}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showTemplateLibrary ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Template Library
            <span className="text-slate-500 font-normal">
              ({templates.length} templates)
            </span>
          </button>

          {showTemplateLibrary && (
            <div className="mt-4 bg-slate-900/30 border border-slate-800 rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400">
                        {TEMPLATE_ICONS[template.documentType] || TEMPLATE_ICONS.default}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-300">{template.name}</p>
                        <p className="text-xs text-slate-500">
                          {template.scope === 'job' ? 'Job-level' : 'Client-level'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleInstantiateTemplate(template)}
                      disabled={instantiating === template.id || !driveReady}
                      className="px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {instantiating === template.id ? 'Creating...' : 'Use'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ============================================================================
// Artifact Row Component
// ============================================================================

interface MergedArtifact {
  id: string;
  title: string;
  type: string;
  status: ArtifactStatus | string;
  phase?: ArtifactPhase;
  url?: string;
  googleFileUrl?: string;
  createdAt?: string;
  isStale?: boolean;
  source: 'legacy' | 'indexed';
  provenance?: ArtifactProvenance;
  usage?: Artifact['usage'];
}

function ArtifactRow({
  artifact,
  companyId,
}: {
  artifact: MergedArtifact;
  companyId: string;
}) {
  const router = useRouter();

  const handleRowClick = () => {
    if (artifact.url) {
      if (artifact.url.startsWith('http')) {
        window.open(artifact.url, '_blank');
      } else {
        router.push(artifact.url);
      }
    } else if (artifact.googleFileUrl) {
      window.open(artifact.googleFileUrl, '_blank');
    } else if (artifact.source === 'legacy') {
      router.push(getArtifactViewerHref(companyId, artifact.id));
    }
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      onClick={handleRowClick}
      className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-slate-700 transition-colors"
    >
      <div className="flex items-center gap-3">
        {/* Type icon */}
        <div className={`p-2 rounded-lg ${getTypeIconStyle(artifact.type)}`}>
          {getTypeIcon(artifact.type)}
        </div>

        {/* Title and metadata */}
        <div>
          <p className="text-sm font-medium text-slate-300">
            {artifact.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">
              {getArtifactTypeLabel(artifact.type as ArtifactType)}
            </span>
            <StatusBadge status={artifact.status} />
            {artifact.provenance && (
              <ProvenanceBadge provenance={artifact.provenance} />
            )}
            {artifact.phase && (
              <span className="text-xs text-slate-600">{artifact.phase}</span>
            )}
            {artifact.usage && (
              <ArtifactUsageBadge usage={artifact.usage} />
            )}
            {artifact.isStale && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                Stale
              </span>
            )}
            {artifact.createdAt && (
              <span className="text-xs text-slate-600">
                {formatRelativeDate(artifact.createdAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2" onClick={stopPropagation}>
        {artifact.googleFileUrl && (
          <a
            href={artifact.googleFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="Open in Google Drive"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        {artifact.url && !artifact.googleFileUrl && (
          <Link
            href={artifact.url}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors"
          >
            View
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Provenance Badge
// ============================================================================

function ProvenanceBadge({ provenance }: { provenance: ArtifactProvenance }) {
  const config = {
    [ArtifactProvenance.AI]: { icon: <Bot className="w-3 h-3" />, bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
    [ArtifactProvenance.Human]: { icon: <User className="w-3 h-3" />, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    [ArtifactProvenance.Mixed]: { icon: <Users className="w-3 h-3" />, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  }[provenance];

  return (
    <span className={`flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium ${config.bg} ${config.text} border ${config.border} rounded`}>
      {config.icon}
      {getProvenanceLabel(provenance)}
    </span>
  );
}

// ============================================================================
// Status Badge
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'final':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
          <CheckCircle className="w-3 h-3" />
          Final
        </span>
      );
    case 'draft':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded">
          <PencilLine className="w-3 h-3" />
          Draft
        </span>
      );
    case 'archived':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-slate-600/10 text-slate-500 border border-slate-600/30 rounded">
          <Archive className="w-3 h-3" />
          Archived
        </span>
      );
    case 'stale':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
          <AlertTriangle className="w-3 h-3" />
          Stale
        </span>
      );
    case 'superseded':
      return (
        <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-slate-600/10 text-slate-500 border border-slate-600/30 rounded">
          <Archive className="w-3 h-3" />
          Superseded
        </span>
      );
    default:
      return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mergeArtifactSources(
  legacy: Artifact[],
  indexed: CompanyArtifactIndex[]
): MergedArtifact[] {
  const merged: MergedArtifact[] = [];
  const seenIds = new Set<string>();

  // Add indexed artifacts first (canonical source)
  for (const a of indexed) {
    merged.push({
      id: a.id,
      title: a.title,
      type: a.artifactType,
      status: a.status,
      phase: a.phase,
      url: a.url,
      googleFileUrl: a.googleFileId ? `https://docs.google.com/document/d/${a.googleFileId}/edit` : undefined,
      createdAt: a.createdAt,
      source: 'indexed',
      provenance: (a as any).provenance as ArtifactProvenance | undefined,
    });
    seenIds.add(a.id);
  }

  // Add legacy artifacts that aren't in indexed
  for (const a of legacy) {
    if (!seenIds.has(a.id)) {
      merged.push({
        id: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        url: undefined,
        googleFileUrl: a.googleFileUrl ?? undefined,
        createdAt: a.createdAt,
        isStale: a.isStale,
        source: 'legacy',
        usage: a.usage,
      });
    }
  }

  // Sort by createdAt descending
  return merged.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });
}

function applyFilters(
  artifacts: MergedArtifact[],
  status: FilterStatus,
  phase: FilterPhase
): MergedArtifact[] {
  return artifacts.filter(a => {
    // Status filter
    if (status === 'active' && (a.status === 'archived' || a.status === 'superseded')) {
      return false;
    }
    if (status !== 'all' && status !== 'active' && a.status !== status) {
      return false;
    }
    // Phase filter
    if (phase !== 'all' && a.phase !== phase) {
      return false;
    }
    return true;
  });
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'strategy_doc':
    case 'brief_doc':
    case 'rfp_response_doc':
    case 'custom':
    case 'lab_report':
    case 'gap_report':
      return <FileText className="w-4 h-4" />;
    case 'qbr_slides':
    case 'proposal_slides':
      return <Presentation className="w-4 h-4" />;
    case 'media_plan':
    case 'pricing_sheet':
      return <Table className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

function getTypeIconStyle(type: string) {
  switch (type) {
    case 'strategy_doc':
      return 'bg-purple-500/10 text-purple-400';
    case 'lab_report':
      return 'bg-cyan-500/10 text-cyan-400';
    case 'gap_report':
      return 'bg-purple-500/10 text-purple-400';
    case 'rfp_response_doc':
      return 'bg-cyan-500/10 text-cyan-400';
    case 'qbr_slides':
    case 'proposal_slides':
      return 'bg-blue-500/10 text-blue-400';
    case 'media_plan':
    case 'pricing_sheet':
      return 'bg-green-500/10 text-green-400';
    case 'brief_doc':
      return 'bg-amber-500/10 text-amber-400';
    case 'custom':
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

function formatRelativeDate(dateString: string): string {
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

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default ArtifactsClient;
