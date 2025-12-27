'use client';

// app/c/[companyId]/deliver/sales-proposals/[proposalId]/page.tsx
// Proposal Builder Page - Three-pane editor for proposals

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  ChevronLeft,
  Loader2,
  Save,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Circle,
  CheckCircle,
  Edit3,
  Library,
  BookOpen,
} from 'lucide-react';
import type {
  Proposal,
  ProposalSection,
  ProposalSectionKey,
  ProposalWithSections,
} from '@/lib/types/proposal';
import {
  PROPOSAL_SECTION_ORDER,
  PROPOSAL_SECTION_LABELS,
  computeProposalProgress,
} from '@/lib/types/proposal';
import { SaveToLibraryModal } from '@/components/os/library/SaveToLibraryModal';
import { InsertFromLibraryModal } from '@/components/os/library/InsertFromLibraryModal';
import type { ReusableSection } from '@/lib/types/sectionLibrary';

export default function ProposalBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const proposalId = params.proposalId as string;

  // State
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState<ProposalSectionKey>('scope');
  const [editedContent, setEditedContent] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // V3: Section Library modals
  const [showSaveToLibrary, setShowSaveToLibrary] = useState(false);
  const [showInsertFromLibrary, setShowInsertFromLibrary] = useState(false);

  // Fetch proposal data
  const fetchProposal = useCallback(async () => {
    try {
      const response = await fetch(`/api/os/companies/${companyId}/proposals/${proposalId}`);
      if (response.ok) {
        const data: ProposalWithSections = await response.json();
        setProposal(data.proposal);
        setSections(data.sections);

        // Set initial content for first section
        const firstSection = data.sections.find(s => s.sectionKey === 'scope');
        if (firstSection) {
          setEditedContent(firstSection.content || '');
        }
      } else if (response.status === 404) {
        router.push(`/c/${companyId}/deliver/sales-proposals`);
      }
    } catch (err) {
      console.error('Failed to fetch proposal:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, proposalId, router]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  // Get current section
  const currentSection = useMemo(() => {
    return sections.find(s => s.sectionKey === selectedSection);
  }, [sections, selectedSection]);

  // Progress
  const progress = useMemo(() => {
    return computeProposalProgress(sections);
  }, [sections]);

  // Handle section selection
  const handleSectionSelect = useCallback((key: ProposalSectionKey) => {
    // Save current changes prompt if unsaved
    if (hasUnsavedChanges) {
      const confirmSwitch = window.confirm('You have unsaved changes. Discard and switch sections?');
      if (!confirmSwitch) return;
    }

    setSelectedSection(key);
    const section = sections.find(s => s.sectionKey === key);
    setEditedContent(section?.content || '');
    setHasUnsavedChanges(false);
  }, [sections, hasUnsavedChanges]);

  // Handle content change
  const handleContentChange = useCallback((value: string) => {
    setEditedContent(value);
    setHasUnsavedChanges(true);
  }, []);

  // Save section
  const handleSave = useCallback(async () => {
    if (!currentSection) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/proposals/${proposalId}/sections/${selectedSection}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editedContent,
            sourceType: 'manual',
          }),
        }
      );

      if (response.ok) {
        const { section: updatedSection } = await response.json();
        setSections(prev => prev.map(s =>
          s.sectionKey === selectedSection ? updatedSection : s
        ));
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Failed to save section:', err);
    } finally {
      setSaving(false);
    }
  }, [companyId, proposalId, selectedSection, editedContent, currentSection]);

  // Approve section
  const handleApprove = useCallback(async () => {
    if (!currentSection) return;

    // Save first if there are changes
    if (hasUnsavedChanges) {
      await handleSave();
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/proposals/${proposalId}/sections/${selectedSection}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved' }),
        }
      );

      if (response.ok) {
        const { section: updatedSection } = await response.json();
        setSections(prev => prev.map(s =>
          s.sectionKey === selectedSection ? updatedSection : s
        ));
      }
    } catch (err) {
      console.error('Failed to approve section:', err);
    } finally {
      setSaving(false);
    }
  }, [companyId, proposalId, selectedSection, currentSection, hasUnsavedChanges, handleSave]);

  // V3: Handle insert from library
  const handleInsertFromLibrary = useCallback((section: ReusableSection) => {
    // Append or replace content based on whether there's existing content
    if (editedContent.trim()) {
      // Append with separator
      setEditedContent(prev => `${prev}\n\n---\n\n${section.content}`);
    } else {
      // Replace
      setEditedContent(section.content);
    }
    setHasUnsavedChanges(true);
  }, [editedContent]);

  // Get section icon
  const getSectionIcon = (section: ProposalSection) => {
    switch (section.status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'draft':
        return <Edit3 className="w-4 h-4 text-blue-400" />;
      default:
        return <Circle className="w-4 h-4 text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-slate-400 mb-4">Proposal not found</p>
        <Link
          href={`/c/${companyId}/deliver/sales-proposals`}
          className="text-blue-400 hover:text-blue-300"
        >
          Back to Proposals
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/c/${companyId}/deliver/sales-proposals`}
              className="text-slate-400 hover:text-slate-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white">{proposal.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-500">
                  {progress.progressPercent}% complete
                </span>
                {proposal.sourceRfpId && (
                  <span className="text-xs text-blue-400">Converted from RFP</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {proposal.status === 'draft' ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                Draft
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Three-pane layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: Section navigation */}
        <div className="w-64 border-r border-slate-800 bg-slate-900/30 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Sections
            </h2>
            <div className="space-y-1">
              {PROPOSAL_SECTION_ORDER.map((key) => {
                const section = sections.find(s => s.sectionKey === key);
                if (!section) return null;

                return (
                  <button
                    key={key}
                    onClick={() => handleSectionSelect(key)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                      selectedSection === key
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                    }`}
                  >
                    {getSectionIcon(section)}
                    <span className="flex-1 text-left truncate">
                      {PROPOSAL_SECTION_LABELS[key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress summary */}
          <div className="p-4 border-t border-slate-800">
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Empty</span>
                <span>{progress.emptySections}</span>
              </div>
              <div className="flex justify-between">
                <span>Draft</span>
                <span>{progress.draftSections}</span>
              </div>
              <div className="flex justify-between">
                <span>Approved</span>
                <span>{progress.approvedSections}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center pane: Content editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentSection && (
            <>
              {/* Section header */}
              <div className="flex-shrink-0 border-b border-slate-800 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white">
                      {PROPOSAL_SECTION_LABELS[currentSection.sectionKey]}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {currentSection.sourceType === 'rfp_converted'
                        ? 'Converted from RFP'
                        : currentSection.sourceType === 'library'
                        ? 'From library'
                        : 'Manual entry'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* V3: Library buttons */}
                    <button
                      onClick={() => setShowInsertFromLibrary(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg transition-colors"
                      title="Insert content from section library"
                    >
                      <BookOpen className="w-3 h-3" />
                      Insert
                    </button>
                    <button
                      onClick={() => setShowSaveToLibrary(true)}
                      disabled={!editedContent.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 text-purple-300 border border-purple-500/30 rounded-lg transition-colors"
                      title="Save this section to library"
                    >
                      <Library className="w-3 h-3" />
                      Save
                    </button>
                    <div className="w-px h-4 bg-slate-700" />
                    <button
                      onClick={handleSave}
                      disabled={saving || !hasUnsavedChanges}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </button>
                    {currentSection.status !== 'approved' && (
                      <button
                        onClick={handleApprove}
                        disabled={saving || currentSection.status === 'empty'}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 disabled:bg-slate-800 disabled:text-slate-500 text-emerald-300 rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-y-auto p-6">
                <textarea
                  value={editedContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder={`Write content for ${PROPOSAL_SECTION_LABELS[currentSection.sectionKey]}...`}
                  className="w-full h-full min-h-[400px] bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-mono"
                />
              </div>
            </>
          )}
        </div>

        {/* Right pane: Metadata */}
        <div className="w-72 border-l border-slate-800 bg-slate-900/30 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Proposal Details
            </h2>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status</label>
                <div className="flex items-center gap-2 text-sm">
                  {proposal.status === 'approved' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Approved</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-amber-400">Draft</span>
                    </>
                  )}
                </div>
              </div>

              {/* Source */}
              {proposal.sourceRfpId && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Source</label>
                  <Link
                    href={`/c/${companyId}/deliver/rfp/${proposal.sourceRfpId}`}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    View source RFP
                  </Link>
                </div>
              )}

              {/* Created */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Created</label>
                <span className="text-sm text-slate-300">
                  {proposal.createdAt && new Date(proposal.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Updated */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Last Updated</label>
                <span className="text-sm text-slate-300">
                  {proposal.updatedAt && new Date(proposal.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Tips */}
            <div className="mt-6 p-3 bg-slate-800/50 rounded-lg">
              <h3 className="text-xs font-medium text-slate-400 mb-2">Tips</h3>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Edit each section and save your changes</li>
                <li>• Approve sections when ready</li>
                <li>• All sections must be approved to finalize</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* V3: Section Library Modals */}
      {showSaveToLibrary && currentSection && (
        <SaveToLibraryModal
          companyId={companyId}
          initialTitle={PROPOSAL_SECTION_LABELS[currentSection.sectionKey]}
          initialContent={editedContent}
          source="proposal"
          sourceId={proposalId}
          sourceSectionKey={currentSection.sectionKey}
          onClose={() => setShowSaveToLibrary(false)}
        />
      )}

      {showInsertFromLibrary && (
        <InsertFromLibraryModal
          companyId={companyId}
          onClose={() => setShowInsertFromLibrary(false)}
          onInsert={handleInsertFromLibrary}
        />
      )}
    </div>
  );
}
