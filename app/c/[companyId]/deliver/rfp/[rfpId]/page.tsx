'use client';

// app/c/[companyId]/deliver/rfp/[rfpId]/page.tsx
// RFP Builder Page - Three-pane layout
// V2: Includes readiness warnings, trust indicators, drift detection

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Loader2,
  Users,
  Briefcase,
  Star,
  DollarSign,
  Calendar,
  Wand2,
  Check,
  AlertTriangle,
  ExternalLink,
  Save,
  History,
  ArrowRightLeft,
  Library,
  BookOpen,
} from 'lucide-react';
import type { Rfp, RfpSection, RfpBindings, RfpSectionKey } from '@/lib/types/rfp';
import type { FirmBrainHealth, FirmBrainSnapshot, TeamMember, CaseStudy, Reference, PricingTemplate, PlanTemplate } from '@/lib/types/firmBrain';
import { getRfpUIState, type RfpUIState, type RfpDataInput } from '@/lib/os/ui/rfpUiState';
import { calculateFirmBrainReadiness } from '@/lib/os/ai/firmBrainReadiness';
import { getDriftDetails, type FirmBrainDriftDetails } from '@/lib/os/ai/firmBrainSnapshot';
import { FirmBrainReadinessBanner } from '@/components/os/rfp/FirmBrainReadinessBanner';
import { FirmBrainDriftWarning } from '@/components/os/rfp/FirmBrainDriftWarning';
import { SectionTrustIndicators, SectionTrustBadge } from '@/components/os/rfp/SectionTrustIndicators';
import { SaveToLibraryModal } from '@/components/os/library/SaveToLibraryModal';
import { InsertFromLibraryModal } from '@/components/os/library/InsertFromLibraryModal';
import { RfpRequirementsPanel, SectionRequirementsBadge } from '@/components/os/rfp/RfpRequirementsPanel';
import { WinStrategyPanel, SectionAlignmentBadge } from '@/components/os/rfp/WinStrategyPanel';
import { BidReadinessPanel } from '@/components/os/rfp/BidReadinessPanel';
import {
  SubmissionReadinessModal,
  useSubmissionGate,
  type SubmissionSnapshot,
} from '@/components/os/rfp/SubmissionReadinessModal';
import {
  OutcomeCaptureModal,
  useOutcomeCapture,
} from '@/components/os/rfp/OutcomeCaptureModal';
import type { OutcomeCaptureData } from '@/lib/types/rfp';
import {
  useFirmOutcomeInsights,
  hasFirmInsightsForDisplay,
  getRelevantInsights,
  getSubmissionInsights,
} from '@/hooks/useOutcomeInsights';
import { computeRubricCoverage } from '@/lib/os/rfp/computeRubricCoverage';
import { computeStrategyHealth } from '@/lib/types/rfpWinStrategy';
import { computeBidReadiness, type BidReadiness } from '@/lib/os/rfp/computeBidReadiness';
import { createDefaultPersonaSettings } from '@/lib/types/rfpEvaluatorPersona';
import type { RfpFocusCallbacks } from '@/lib/os/rfp/focus';
import type { ReusableSection } from '@/lib/types/sectionLibrary';

const SECTION_LABELS: Record<RfpSectionKey, string> = {
  agency_overview: 'Agency Overview',
  approach: 'Our Approach',
  team: 'Proposed Team',
  work_samples: 'Work Samples',
  plan_timeline: 'Plan & Timeline',
  pricing: 'Investment',
  references: 'References',
};

const SECTION_ORDER: RfpSectionKey[] = [
  'agency_overview',
  'approach',
  'team',
  'work_samples',
  'plan_timeline',
  'pricing',
  'references',
];

export default function RfpBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;
  const rfpId = params.rfpId as string;

  // Data state
  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [sections, setSections] = useState<RfpSection[]>([]);
  const [bindings, setBindings] = useState<RfpBindings | null>(null);
  const [firmBrainHealth, setFirmBrainHealth] = useState<FirmBrainHealth | null>(null);
  const [loading, setLoading] = useState(true);

  // Firm Brain resources for binding selector
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [pricingTemplates, setPricingTemplates] = useState<PricingTemplate[]>([]);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);

  // V2: Firm Brain readiness and drift tracking
  const [firmBrainSnapshot, setFirmBrainSnapshot] = useState<FirmBrainSnapshot | null>(null);
  const [showPreviousContent, setShowPreviousContent] = useState(false);

  // UI state
  const [selectedSectionKey, setSelectedSectionKey] = useState<RfpSectionKey>('agency_overview');
  const [editedContent, setEditedContent] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [savingContent, setSavingContent] = useState(false);
  const [savingBindings, setSavingBindings] = useState(false);
  const [_exporting, _setExporting] = useState(false);
  const [converting, setConverting] = useState(false);

  // V3: Section Library modals
  const [showSaveToLibrary, setShowSaveToLibrary] = useState(false);
  const [showInsertFromLibrary, setShowInsertFromLibrary] = useState(false);

  // V5: Status change with outcome capture
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [rfpRes, healthRes, teamRes, casesRes, refsRes, pricingRes, plansRes] = await Promise.all([
        fetch(`/api/os/companies/${companyId}/rfps/${rfpId}`),
        fetch('/api/settings/firm-brain/health'),
        fetch('/api/settings/firm-brain/team-members'),
        fetch('/api/settings/firm-brain/case-studies'),
        fetch('/api/settings/firm-brain/references'),
        fetch('/api/settings/firm-brain/pricing-templates'),
        fetch('/api/settings/firm-brain/plan-templates'),
      ]);

      if (rfpRes.ok) {
        const data = await rfpRes.json();
        setRfp(data.rfp);
        setSections(data.sections || []);
        setBindings(data.bindings);
      }

      if (healthRes.ok) {
        const data = await healthRes.json();
        setFirmBrainHealth(data);
      }

      // V2: Store full snapshot for readiness and drift
      const fetchedTeam = teamRes.ok ? (await teamRes.json()).teamMembers || [] : [];
      const fetchedCases = casesRes.ok ? (await casesRes.json()).caseStudies || [] : [];
      const fetchedRefs = refsRes.ok ? (await refsRes.json()).references || [] : [];
      const fetchedPricing = pricingRes.ok ? (await pricingRes.json()).pricingTemplates || [] : [];
      const fetchedPlans = plansRes.ok ? (await plansRes.json()).planTemplates || [] : [];

      setTeamMembers(fetchedTeam);
      setCaseStudies(fetchedCases);
      setReferences(fetchedRefs);
      setPricingTemplates(fetchedPricing);
      setPlanTemplates(fetchedPlans);

      // Build full snapshot
      setFirmBrainSnapshot({
        agencyProfile: firmBrainHealth || null,
        teamMembers: fetchedTeam,
        caseStudies: fetchedCases,
        references: fetchedRefs,
        pricingTemplates: fetchedPricing,
        planTemplates: fetchedPlans,
        snapshotAt: new Date().toISOString(),
      } as FirmBrainSnapshot);
    } catch (err) {
      console.error('Failed to fetch RFP data:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, rfpId]);

  // V2: Compute Firm Brain readiness
  const firmBrainReadiness = useMemo(() => {
    if (!firmBrainSnapshot) return null;
    return calculateFirmBrainReadiness(firmBrainSnapshot);
  }, [firmBrainSnapshot]);

  // V2: Check for drift
  const driftDetails = useMemo<FirmBrainDriftDetails>(() => {
    if (!firmBrainSnapshot || !rfp?.firmBrainSnapshot) {
      return { hasDrifted: false, message: null, recommendation: null, severity: 'none' };
    }
    return getDriftDetails(firmBrainSnapshot, rfp.firmBrainSnapshot);
  }, [firmBrainSnapshot, rfp?.firmBrainSnapshot]);

  // V4: Bid readiness computations
  // Note: personaSettings could be stored on RFP in future, for now use defaults
  const personaSettings = useMemo(() => {
    return createDefaultPersonaSettings();
  }, []);

  const strategyHealth = useMemo(() => {
    return computeStrategyHealth(rfp?.winStrategy ?? null);
  }, [rfp?.winStrategy]);

  const rubricCoverage = useMemo(() => {
    if (!rfp?.winStrategy || sections.length === 0) return null;
    return computeRubricCoverage(rfp.winStrategy, sections, personaSettings);
  }, [rfp?.winStrategy, sections, personaSettings]);

  // V4: Compute bid readiness for submission gate
  const bidReadiness = useMemo<BidReadiness | null>(() => {
    return computeBidReadiness({
      firmBrainReadiness,
      strategyHealth,
      rubricCoverage,
      strategy: rfp?.winStrategy ?? null,
      sections,
      personaSettings,
    });
  }, [firmBrainReadiness, strategyHealth, rubricCoverage, rfp?.winStrategy, sections, personaSettings]);

  // V5: Firm-wide outcome insights for callouts
  const { data: firmInsights } = useFirmOutcomeInsights({
    timeRange: '365d',
    minConfidence: 'medium',
  });

  // Get relevant insights for current bid readiness
  const relevantInsights = useMemo(() => {
    if (!bidReadiness || !hasFirmInsightsForDisplay(firmInsights)) return [];
    return getRelevantInsights(firmInsights, bidReadiness, 2);
  }, [firmInsights, bidReadiness]);

  // Get submission-specific insights
  const submissionInsights = useMemo(() => {
    if (!bidReadiness || !hasFirmInsightsForDisplay(firmInsights)) return [];
    const hasCriticalRisks = bidReadiness.topRisks.some(r => r.severity === 'critical');
    const hasRisks = bidReadiness.topRisks.length > 0;
    return getSubmissionInsights(firmInsights, bidReadiness.recommendation, hasCriticalRisks, hasRisks, 2);
  }, [firmInsights, bidReadiness]);

  // V4: Focus callbacks for bid readiness navigation
  const [_winStrategyExpanded, setWinStrategyExpanded] = useState(false);

  const focusCallbacks = useMemo<RfpFocusCallbacks>(() => ({
    setSelectedSection: setSelectedSectionKey,
    openWinStrategyPanel: () => setWinStrategyExpanded(true),
    scrollToElement: (elementId: string) => {
      const el = document.getElementById(elementId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }), []);

  // V4: Submission gate for export/submit actions
  const _handleSubmissionWithSnapshot = useCallback(async (snapshot: SubmissionSnapshot) => {
    // Store snapshot and update RFP status
    const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    });

    if (response.ok) {
      const data = await response.json();
      setRfp(data.rfp);
    } else {
      throw new Error('Failed to store submission snapshot');
    }
  }, [companyId, rfpId]);

  const handleExportWithSnapshot = useCallback(async (snapshot: SubmissionSnapshot) => {
    // Store snapshot and export
    const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    });

    if (response.ok) {
      const data = await response.json();
      // Update RFP with snapshot
      if (data.rfp) {
        setRfp(data.rfp);
      }
      // Open exported document
      if (data.artifact?.googleFileUrl) {
        window.open(data.artifact.googleFileUrl, '_blank');
      }
    } else {
      throw new Error('Failed to export');
    }
  }, [companyId, rfpId]);

  const submissionGate = useSubmissionGate({
    readiness: bidReadiness,
    onSubmit: handleExportWithSnapshot, // Used for both export and submit
    onFixIssues: () => {
      // Focus on highest impact fix
      if (bidReadiness?.highestImpactFixes[0]) {
        const fix = bidReadiness.highestImpactFixes[0];
        setSelectedSectionKey(fix.sectionKey as RfpSectionKey);
      }
    },
  });

  // V5: Outcome capture for won/lost status transitions
  const handleOutcomeSave = useCallback(async (
    outcome: 'won' | 'lost',
    data: OutcomeCaptureData
  ) => {
    const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: outcome,
        ...data,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      setRfp(result.rfp);
    } else {
      throw new Error('Failed to save outcome');
    }
  }, [companyId, rfpId]);

  const outcomeCapture = useOutcomeCapture({
    onSave: handleOutcomeSave,
    competitors: rfp?.competitors || [],
  });

  // V5: Handle status change - triggers modal for won/lost
  const handleStatusChange = useCallback(async (newStatus: Rfp['status']) => {
    if (newStatus === 'won' || newStatus === 'lost') {
      // Open outcome capture modal
      outcomeCapture.open(newStatus);
    } else {
      // Update status directly
      setUpdatingStatus(true);
      try {
        const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });

        if (response.ok) {
          const result = await response.json();
          setRfp(result.rfp);
        }
      } catch (err) {
        console.error('Failed to update status:', err);
      } finally {
        setUpdatingStatus(false);
      }
    }
  }, [companyId, rfpId, outcomeCapture]);

  // Handle outcome skip (just update status without outcome data)
  const handleOutcomeSkip = useCallback(async () => {
    if (!outcomeCapture.outcome) return;

    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: outcomeCapture.outcome }),
      });

      if (response.ok) {
        const result = await response.json();
        setRfp(result.rfp);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
      outcomeCapture.close();
    }
  }, [companyId, rfpId, outcomeCapture]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update edited content when section changes
  useEffect(() => {
    const section = sections.find(s => s.sectionKey === selectedSectionKey);
    setEditedContent(section?.contentWorking || section?.contentApproved || '');
  }, [selectedSectionKey, sections]);

  // Derive UI state
  const dataInput: RfpDataInput = { rfp, sections, bindings, firmBrainHealth };
  const uiState: RfpUIState = getRfpUIState(dataInput, companyId);

  // Handlers
  const handleGenerateSection = useCallback(async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}/sections/${selectedSectionKey}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: true }),
      });
      if (response.ok) {
        const data = await response.json();
        setSections(prev => prev.map(s =>
          s.sectionKey === selectedSectionKey ? data.section : s
        ));
        setEditedContent(data.section.contentWorking || '');
      }
    } catch (err) {
      console.error('Failed to generate section:', err);
    } finally {
      setGenerating(false);
    }
  }, [companyId, rfpId, selectedSectionKey]);

  const handleSaveContent = useCallback(async () => {
    setSavingContent(true);
    try {
      const section = sections.find(s => s.sectionKey === selectedSectionKey);
      if (!section) return;

      const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}/sections/${selectedSectionKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentWorking: editedContent,
          status: 'draft',
          sourceType: 'manual',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSections(prev => prev.map(s =>
          s.sectionKey === selectedSectionKey ? data.section : s
        ));
      }
    } catch (err) {
      console.error('Failed to save content:', err);
    } finally {
      setSavingContent(false);
    }
  }, [companyId, rfpId, selectedSectionKey, editedContent, sections]);

  const handleApproveSection = useCallback(async () => {
    const section = sections.find(s => s.sectionKey === selectedSectionKey);
    if (!section) return;

    try {
      const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}/sections/${selectedSectionKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentApproved: editedContent,
          status: 'approved',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setSections(prev => prev.map(s =>
          s.sectionKey === selectedSectionKey ? data.section : s
        ));
      }
    } catch (err) {
      console.error('Failed to approve section:', err);
    }
  }, [companyId, rfpId, selectedSectionKey, editedContent, sections]);

  const handleSaveBindings = useCallback(async (updates: Partial<RfpBindings>) => {
    setSavingBindings(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}/bindings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const data = await response.json();
        setBindings(data.bindings);
      }
    } catch (err) {
      console.error('Failed to save bindings:', err);
    } finally {
      setSavingBindings(false);
    }
  }, [companyId, rfpId]);

  // V4: Updated to use submission gate
  const handleExport = useCallback(() => {
    // Open submission readiness modal instead of exporting directly
    submissionGate.openForExport();
  }, [submissionGate]);

  // V3: Convert RFP to Proposal
  const handleConvertToProposal = useCallback(async () => {
    setConverting(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/rfps/${rfpId}/convert-to-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.proposal?.id) {
          router.push(`/c/${companyId}/deliver/sales-proposals/${data.proposal.id}`);
        }
      } else {
        const errorData = await response.json();
        alert(errorData.reason || 'Failed to convert RFP to proposal');
      }
    } catch (err) {
      console.error('Failed to convert to proposal:', err);
      alert('Failed to convert RFP to proposal');
    } finally {
      setConverting(false);
    }
  }, [companyId, rfpId, router]);

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
  }, [editedContent]);

  const selectedSection = sections.find(s => s.sectionKey === selectedSectionKey);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!rfp) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">RFP not found</p>
        <Link href={`/c/${companyId}/deliver/rfp`} className="text-purple-400 hover:text-purple-300 mt-2 inline-block">
          Back to RFPs
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/c/${companyId}/deliver/rfp`}
              className="text-slate-400 hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white">{rfp.title}</h1>
              <p className="text-xs text-slate-500">{uiState.banner.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress */}
            <div className="text-xs text-slate-400">
              {uiState.progressSummary.completedSections}/{uiState.progressSummary.totalSections} approved
            </div>

            {/* V5: Status Selector */}
            <select
              value={rfp.status}
              onChange={(e) => handleStatusChange(e.target.value as Rfp['status'])}
              disabled={updatingStatus || outcomeCapture.isSaving}
              className={`px-2 py-1 text-xs rounded border transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
                rfp.status === 'won' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
                rfp.status === 'lost' ? 'bg-slate-700 border-slate-600 text-slate-400' :
                rfp.status === 'submitted' ? 'bg-purple-500/20 border-purple-500/30 text-purple-300' :
                rfp.status === 'review' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
                rfp.status === 'assembling' ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' :
                'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <option value="intake">Intake</option>
              <option value="assembling">Assembling</option>
              <option value="review">In Review</option>
              <option value="submitted">Submitted</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>

            {/* V3: Convert to Proposal */}
            <button
              onClick={handleConvertToProposal}
              disabled={converting || rfp.status === 'intake'}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-slate-800 disabled:text-slate-500 text-blue-300 border border-blue-500/30 rounded-lg transition-colors"
              title="Convert RFP content to a sales proposal"
            >
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Convert to Proposal
            </button>

            {/* Primary CTA */}
            {uiState.primaryCTA.action === 'export' && (
              <button
                onClick={handleExport}
                disabled={submissionGate.isSubmitting || !uiState.progressSummary.canSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-400 text-white font-medium rounded-lg transition-colors"
              >
                {submissionGate.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Export to Google Doc
              </button>
            )}
          </div>
        </div>

        {/* Banner */}
        {uiState.banner.tone !== 'neutral' && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${
            uiState.banner.tone === 'blocked' ? 'bg-red-500/10 text-red-400' :
            uiState.banner.tone === 'warning' ? 'bg-amber-500/10 text-amber-400' :
            uiState.banner.tone === 'success' ? 'bg-emerald-500/10 text-emerald-400' :
            'bg-blue-500/10 text-blue-400'
          }`}>
            {uiState.banner.body}
          </div>
        )}

        {/* V2: Drift Warning */}
        {driftDetails.hasDrifted && (
          <div className="mt-3">
            <FirmBrainDriftWarning
              drift={driftDetails}
              onRegenerate={handleGenerateSection}
              regenerating={generating}
            />
          </div>
        )}
      </div>

      {/* Three-pane layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Sections Nav */}
        <div className="w-56 flex-shrink-0 border-r border-slate-800 bg-slate-900/30 overflow-y-auto">
          <div className="p-3">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Sections</h2>
            <div className="space-y-1">
              {SECTION_ORDER.map((key) => {
                const section = sections.find(s => s.sectionKey === key);
                return (
                  <button
                    key={key}
                    id={`section-nav-${key}`}
                    onClick={() => setSelectedSectionKey(key)}
                    className={`w-full px-3 py-2 text-left rounded-lg transition-colors flex items-center gap-2 ${
                      selectedSectionKey === key
                        ? 'bg-purple-500/20 text-white'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                    }`}
                  >
                    <span className="flex-1 truncate text-sm">{SECTION_LABELS[key]}</span>
                    {/* V3: Win strategy alignment badge */}
                    {rfp.winStrategy && (
                      <SectionAlignmentBadge
                        sectionKey={key}
                        strategy={rfp.winStrategy}
                      />
                    )}
                    {/* V2.5: Requirements badge */}
                    {rfp.parsedRequirements && (
                      <SectionRequirementsBadge
                        sectionKey={key}
                        requirements={rfp.parsedRequirements}
                      />
                    )}
                    {/* V2: Trust badge showing input usage */}
                    {section?.generatedUsing && (
                      <SectionTrustBadge generatedUsing={section.generatedUsing} />
                    )}
                    {section?.status === 'approved' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    {section?.isStale && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                    {section?.status === 'draft' && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Section Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-white">{SECTION_LABELS[selectedSectionKey]}</h3>
                <p className="text-xs text-slate-500">
                  {selectedSection?.status === 'empty' ? 'No content' :
                   selectedSection?.status === 'draft' ? 'Draft' :
                   selectedSection?.status === 'ready' ? 'Ready for review' :
                   selectedSection?.status === 'approved' ? 'Approved' : 'Unknown'}
                  {selectedSection?.isStale && ' (Stale)'}
                </p>
              </div>
            <div className="flex items-center gap-2">
              {/* V3: Library buttons */}
              <button
                onClick={() => setShowInsertFromLibrary(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg transition-colors"
                title="Insert content from section library"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Insert
              </button>
              <button
                onClick={() => setShowSaveToLibrary(true)}
                disabled={!editedContent.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 text-purple-300 border border-purple-500/30 rounded-lg transition-colors"
                title="Save this section to library"
              >
                <Library className="w-3.5 h-3.5" />
                Save
              </button>
              <div className="w-px h-4 bg-slate-700" />
              <button
                onClick={handleGenerateSection}
                disabled={generating || !uiState.debug.hasBindings}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors"
                title={!uiState.debug.hasBindings ? 'Select team and cases first' : 'Generate with AI'}
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {generating ? 'Generating...' : selectedSection?.contentWorking ? 'Regenerate' : 'Generate'}
              </button>
              <button
                onClick={handleSaveContent}
                disabled={savingContent}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg transition-colors"
              >
                {savingContent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                onClick={handleApproveSection}
                disabled={!editedContent || selectedSection?.status === 'approved'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
            </div>
            </div>

            {/* V2: Trust indicators row */}
            {selectedSection?.generatedUsing && (
              <div className="mt-2 flex items-center justify-between">
                <SectionTrustIndicators
                  generatedUsing={selectedSection.generatedUsing}
                  compact={false}
                />
                {/* V2: Show previous content toggle */}
                {selectedSection.previousContent && (
                  <button
                    onClick={() => setShowPreviousContent(!showPreviousContent)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
                  >
                    <History className="w-3.5 h-3.5" />
                    {showPreviousContent ? 'Hide Previous' : 'View Previous'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* V2: Previous content panel */}
          {showPreviousContent && selectedSection?.previousContent && (
            <div className="flex-shrink-0 px-4 py-2 border-b border-slate-800 bg-slate-800/30">
              <p className="text-xs text-slate-500 mb-1">Previous content (before last regeneration):</p>
              <div className="max-h-32 overflow-y-auto text-xs text-slate-400 font-mono whitespace-pre-wrap">
                {selectedSection.previousContent.slice(0, 500)}
                {selectedSection.previousContent.length > 500 && '...'}
              </div>
            </div>
          )}

          <div className="flex-1 p-4 overflow-y-auto">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-full min-h-[400px] px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono"
              placeholder="Section content will appear here after generation..."
            />
          </div>
        </div>

        {/* Right: Bindings Panel */}
        <div className="w-72 flex-shrink-0 border-l border-slate-800 bg-slate-900/30 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* V4: Bid Readiness Panel */}
            <BidReadinessPanel
              firmBrainReadiness={firmBrainReadiness}
              strategyHealth={strategyHealth}
              rubricCoverage={rubricCoverage}
              strategy={rfp.winStrategy ?? null}
              sections={sections}
              personaSettings={personaSettings}
              focusCallbacks={focusCallbacks}
              variant="compact"
              outcomeInsights={relevantInsights}
            />

            {/* V3: Win Strategy Panel */}
            <WinStrategyPanel
              strategy={rfp.winStrategy}
              sections={sections}
              personaSettings={personaSettings}
              variant="compact"
            />

            {/* V2.5: Parsed Requirements Panel */}
            {rfp.parsedRequirements && (
              <RfpRequirementsPanel
                requirements={rfp.parsedRequirements}
                variant="compact"
              />
            )}

            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bindings</h2>

            {/* V2: Firm Brain Readiness Banner */}
            {firmBrainReadiness && (
              <FirmBrainReadinessBanner
                readiness={firmBrainReadiness}
                variant="compact"
                showSettingsLink={true}
              />
            )}

            {/* Team Members */}
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <Users className="w-3.5 h-3.5" />
                Team Members
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {teamMembers.map(tm => (
                  <label key={tm.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-800/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bindings?.teamMemberIds.includes(tm.id) || false}
                      onChange={(e) => {
                        const ids = bindings?.teamMemberIds || [];
                        handleSaveBindings({
                          teamMemberIds: e.target.checked
                            ? [...ids, tm.id]
                            : ids.filter(id => id !== tm.id)
                        });
                      }}
                      className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
                    />
                    <span className="text-xs text-slate-300 truncate">{tm.name}</span>
                  </label>
                ))}
              </div>
              {teamMembers.length === 0 && (
                <Link href="/settings/firm-brain/team" className="text-xs text-purple-400 hover:text-purple-300">
                  + Add team members
                </Link>
              )}
            </div>

            {/* Case Studies */}
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <Briefcase className="w-3.5 h-3.5" />
                Case Studies
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {caseStudies.map(cs => (
                  <label key={cs.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-800/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bindings?.caseStudyIds.includes(cs.id) || false}
                      onChange={(e) => {
                        const ids = bindings?.caseStudyIds || [];
                        handleSaveBindings({
                          caseStudyIds: e.target.checked
                            ? [...ids, cs.id]
                            : ids.filter(id => id !== cs.id)
                        });
                      }}
                      className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
                    />
                    <span className="text-xs text-slate-300 truncate">{cs.title}</span>
                  </label>
                ))}
              </div>
              {caseStudies.length === 0 && (
                <Link href="/settings/firm-brain/case-studies" className="text-xs text-purple-400 hover:text-purple-300">
                  + Add case studies
                </Link>
              )}
            </div>

            {/* References */}
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <Star className="w-3.5 h-3.5" />
                References
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {references.filter(r => r.permissionStatus === 'confirmed').map(ref => (
                  <label key={ref.id} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-800/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bindings?.referenceIds.includes(ref.id) || false}
                      onChange={(e) => {
                        const ids = bindings?.referenceIds || [];
                        handleSaveBindings({
                          referenceIds: e.target.checked
                            ? [...ids, ref.id]
                            : ids.filter(id => id !== ref.id)
                        });
                      }}
                      className="rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
                    />
                    <span className="text-xs text-slate-300 truncate">{ref.client}</span>
                  </label>
                ))}
              </div>
              {references.filter(r => r.permissionStatus === 'confirmed').length === 0 && (
                <Link href="/settings/firm-brain/references" className="text-xs text-purple-400 hover:text-purple-300">
                  + Add confirmed references
                </Link>
              )}
            </div>

            {/* Pricing Template */}
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <DollarSign className="w-3.5 h-3.5" />
                Pricing Template
              </div>
              <select
                value={bindings?.pricingTemplateId || ''}
                onChange={(e) => handleSaveBindings({ pricingTemplateId: e.target.value || null })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">None</option>
                {pricingTemplates.map(pt => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </div>

            {/* Plan Template */}
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <Calendar className="w-3.5 h-3.5" />
                Plan Template
              </div>
              <select
                value={bindings?.planTemplateId || ''}
                onChange={(e) => handleSaveBindings({ planTemplateId: e.target.value || null })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">None</option>
                {planTemplates.map(pt => (
                  <option key={pt.id} value={pt.id}>{pt.templateName}</option>
                ))}
              </select>
            </div>

            {/* Binding warnings */}
            {uiState.bindingsPanel.showWarnings && uiState.bindingsPanel.warnings.length > 0 && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-400 font-medium mb-1">Binding Requirements:</p>
                <ul className="text-xs text-amber-400/80 space-y-0.5">
                  {uiState.bindingsPanel.warnings.map((w, i) => (
                    <li key={i}>- {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {savingBindings && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* V3: Section Library Modals */}
      {showSaveToLibrary && (
        <SaveToLibraryModal
          companyId={companyId}
          initialTitle={SECTION_LABELS[selectedSectionKey]}
          initialContent={editedContent}
          source="rfp"
          sourceId={rfpId}
          sourceSectionKey={selectedSectionKey}
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

      {/* V4: Submission Readiness Gate Modal */}
      {submissionGate.modalProps && bidReadiness && (
        <SubmissionReadinessModal
          readiness={bidReadiness}
          {...submissionGate.modalProps}
          submissionInsights={submissionInsights}
        />
      )}

      {/* V5: Outcome Capture Modal */}
      {outcomeCapture.isOpen && outcomeCapture.outcome && (
        <OutcomeCaptureModal
          outcome={outcomeCapture.outcome}
          knownCompetitors={rfp.competitors || []}
          onSave={(data) => {
            handleOutcomeSave(outcomeCapture.outcome!, data);
            outcomeCapture.close();
          }}
          onSkip={handleOutcomeSkip}
          isLoading={outcomeCapture.isSaving || updatingStatus}
        />
      )}
    </div>
  );
}
