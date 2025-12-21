'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { OpportunityItem } from '@/lib/types/pipeline';
import type { PipelineStage } from '@/lib/types/pipeline';
import {
  getStageLabel,
  getStageColorClass,
  getDealHealthLabel,
  getDealHealthColorClasses,
  ALL_STAGES,
} from '@/lib/types/pipeline';
import type { ActivityDTO } from '@/lib/types/activity';
import {
  getActivityTypeLabel,
  getActivityDirectionColorClasses,
  getActivityOpenUrl,
} from '@/lib/types/activity';
import { MarkWonButton } from './MarkWonButton';

interface OpportunityWorkspaceClientProps {
  opportunity: OpportunityItem;
  companyName: string | null;
  companyId: string | null;
  companyDomain: string | null;
  activities?: ActivityDTO[];
}

// Format currency
const formatCurrency = (num?: number | null) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

// Format date for display
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

// Format date for input
const formatDateForInput = (dateStr?: string | null) => {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
};

// Calculate days since a date
const daysSince = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

// Check if a date is in the past
const isOverdue = (dateStr?: string | null) => {
  if (!dateStr) return false;
  const today = new Date().toISOString().split('T')[0];
  return dateStr < today;
};

// Get budget confidence label
const getBudgetConfidenceLabel = (confidence?: string | null) => {
  const labels: Record<string, string> = {
    confirmed: 'Confirmed',
    likely: 'Likely',
    unknown: 'Unknown',
    no_budget: 'No Budget',
  };
  return labels[confidence || ''] || '—';
};

// ============================================================================
// Stage Change Validation (Soft Prerequisites)
// ============================================================================

type StageCheckIssueId =
  | 'missing_next_step'
  | 'missing_next_step_due'
  | 'missing_value'
  | 'missing_close_date'
  | 'missing_decision_owner';

type StageCheckFixAction = 'focus_next_step' | 'suggest_close_date';

interface StageCheckIssue {
  id: StageCheckIssueId;
  label: string;
  severity: 'WARN';
  fixAction?: StageCheckFixAction;
}

/**
 * Stage prerequisite rules (soft validation).
 * Maps stage -> array of issue checks in priority order.
 */
const STAGE_PREREQUISITES: Record<
  string,
  Array<{
    id: StageCheckIssueId;
    label: string;
    check: (state: OpportunityDraft) => boolean; // returns true if MISSING
    fixAction?: StageCheckFixAction;
  }>
> = {
  // Discovery / Clarification
  discovery_clarification: [
    {
      id: 'missing_next_step',
      label: 'Next Step is required',
      check: (s) => !s.nextStep?.trim(),
      fixAction: 'focus_next_step',
    },
    {
      id: 'missing_next_step_due',
      label: 'Next Step Due Date is recommended',
      check: (s) => !s.nextStepDue,
    },
  ],
  // Solution Shaping
  solution_shaping: [
    {
      id: 'missing_next_step',
      label: 'Next Step is required',
      check: (s) => !s.nextStep?.trim(),
      fixAction: 'focus_next_step',
    },
    {
      id: 'missing_next_step_due',
      label: 'Next Step Due Date is recommended',
      check: (s) => !s.nextStepDue,
    },
  ],
  // Proposal Submitted
  proposal_submitted: [
    {
      id: 'missing_value',
      label: 'Deal Value (USD) should be set',
      check: (s) => !s.value,
    },
    {
      id: 'missing_close_date',
      label: 'Expected Close Date should be set',
      check: (s) => !s.closeDate,
      fixAction: 'suggest_close_date',
    },
    {
      id: 'missing_decision_owner',
      label: 'Decision Owner should be identified',
      check: (s) => !s.decisionOwner?.trim(),
    },
  ],
  // Decision / Negotiation
  decision: [
    {
      id: 'missing_close_date',
      label: 'Expected Close Date should be set',
      check: (s) => !s.closeDate,
      fixAction: 'suggest_close_date',
    },
    {
      id: 'missing_next_step',
      label: 'Next Step is required',
      check: (s) => !s.nextStep?.trim(),
      fixAction: 'focus_next_step',
    },
    {
      id: 'missing_value',
      label: 'Deal Value (USD) should be set',
      check: (s) => !s.value,
    },
  ],
  // Won
  won: [
    {
      id: 'missing_value',
      label: 'Deal Value (USD) should be set',
      check: (s) => !s.value,
    },
  ],
};

interface OpportunityDraft {
  nextStep: string;
  nextStepDue: string;
  value: string;
  closeDate: string;
  decisionOwner: string;
}

/**
 * Compute stage prerequisite issues for a given target stage.
 * Returns issues ordered by importance.
 */
function computeStageIssues(
  draft: OpportunityDraft,
  targetStage: PipelineStage | 'other'
): StageCheckIssue[] {
  const rules = STAGE_PREREQUISITES[targetStage];
  if (!rules) return [];

  const issues: StageCheckIssue[] = [];
  for (const rule of rules) {
    if (rule.check(draft)) {
      issues.push({
        id: rule.id,
        label: rule.label,
        severity: 'WARN',
        fixAction: rule.fixAction,
      });
    }
  }
  return issues;
}

/**
 * Derive a health explanation based on opportunity data.
 * This is READ-ONLY - never writes to Airtable or modifies deal health.
 *
 * Stage-aware thresholds:
 * - Late stages (proposal_submitted, decision): longer thresholds for deals in final phases
 *   - at_risk inactivity: 21 days (vs 14 for earlier stages)
 *   - stalled inactivity: 45 days (vs 30 for earlier stages)
 *
 * Explanation strings by Deal Health:
 * - on_track:
 *   - "Next step defined and recent activity."
 *   - "Next step defined."
 *   - "Deal appears healthy."
 * - at_risk:
 *   - "Next step overdue (due {date})."
 *   - "No activity for {N}+ days (last activity {date})."
 *   - "No next step defined."
 *   - "Deal may need attention."
 * - stalled:
 *   - "No next step defined."
 *   - "No activity for {N}+ days (last activity {date})."
 *   - "Next step significantly overdue (due {date})."
 *   - "Deal is stalled."
 * - null/undefined/closed: no explanation
 */
function getHealthExplanation(params: {
  dealHealth: 'on_track' | 'at_risk' | 'stalled' | null | undefined;
  stage: string;
  nextStep: string | null | undefined;
  nextStepDue: string | null | undefined;
  daysSinceActivity: number | null;
  lastActivityAt: string | null | undefined;
  isClosed: boolean;
}): string | null {
  const { dealHealth, stage, nextStep, nextStepDue, daysSinceActivity, lastActivityAt, isClosed } = params;

  // No explanation for closed deals or missing health
  if (isClosed || !dealHealth) return null;

  const hasNextStep = !!nextStep?.trim();
  const isNextStepOverdue = nextStepDue ? isOverdue(nextStepDue) : false;
  const daysInactive = daysSinceActivity ?? 0;

  // Stage-aware thresholds: late-stage deals get more time
  const isLateStage = stage === 'proposal_submitted' || stage === 'decision';
  const atRiskInactivityThreshold = isLateStage ? 21 : 14;
  const stalledInactivityThreshold = isLateStage ? 45 : 30;

  // Format dates for concrete explanations
  const formattedDueDate = nextStepDue ? formatDate(nextStepDue) : null;
  const formattedLastActivity = lastActivityAt ? formatDate(lastActivityAt) : null;

  switch (dealHealth) {
    case 'on_track':
      if (hasNextStep && daysInactive < 7) {
        return 'Next step defined and recent activity.';
      } else if (hasNextStep) {
        return 'Next step defined.';
      }
      return 'Deal appears healthy.';

    case 'at_risk':
      if (isNextStepOverdue && formattedDueDate) {
        return `Next step overdue (due ${formattedDueDate}).`;
      } else if (isNextStepOverdue) {
        return 'Next step overdue.';
      } else if (daysInactive >= atRiskInactivityThreshold) {
        if (formattedLastActivity) {
          return `No activity for ${daysInactive}+ days (last activity ${formattedLastActivity}).`;
        }
        return `No activity for ${daysInactive}+ days.`;
      } else if (!hasNextStep) {
        return 'No next step defined.';
      }
      return 'Deal may need attention.';

    case 'stalled':
      if (!hasNextStep) {
        return 'No next step defined.';
      } else if (daysInactive >= stalledInactivityThreshold) {
        if (formattedLastActivity) {
          return `No activity for ${daysInactive}+ days (last activity ${formattedLastActivity}).`;
        }
        return `No activity for ${daysInactive}+ days.`;
      } else if (isNextStepOverdue && formattedDueDate) {
        return `Next step significantly overdue (due ${formattedDueDate}).`;
      } else if (isNextStepOverdue) {
        return 'Next step significantly overdue.';
      }
      return 'Deal is stalled.';

    default:
      return null;
  }
}

// Budget confidence options for dropdown
const BUDGET_CONFIDENCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
  
];

// Opportunity type options (common types)
const OPPORTUNITY_TYPE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'New Business', label: 'New Business' },
  { value: 'Expansion', label: 'Expansion' },
  { value: 'Renewal', label: 'Renewal' },
  { value: 'RFP Response', label: 'RFP Response' },
  { value: 'Inbound Interest', label: 'Inbound Interest' },
  { value: 'Referral', label: 'Referral' },
];

export function OpportunityWorkspaceClient({
  opportunity: initialOpportunity,
  companyName,
  companyId,
  companyDomain,
  activities = [],
}: OpportunityWorkspaceClientProps) {
  const [opportunity, setOpportunity] = useState(initialOpportunity);

  // Momentum fields (existing)
  const [nextStep, setNextStep] = useState(opportunity.nextStep || '');
  const [nextStepDue, setNextStepDue] = useState(formatDateForInput(opportunity.nextStepDue));

  // Deal details fields
  const [stage, setStage] = useState<PipelineStage | 'other'>(opportunity.stage);
  const [value, setValue] = useState<string>(opportunity.value?.toString() || '');
  const [closeDate, setCloseDate] = useState(formatDateForInput(opportunity.closeDate));
  const [owner, setOwner] = useState(opportunity.owner || '');
  const [source, setSource] = useState(opportunity.source || '');
  const [notes, setNotes] = useState(opportunity.notes || '');
  const [deliverableName, setDeliverableName] = useState(opportunity.deliverableName || '');
  const [isEditingName, setIsEditingName] = useState(false);

  // Buying process fields
  const [decisionOwner, setDecisionOwner] = useState(opportunity.decisionOwner || '');
  const [decisionDate, setDecisionDate] = useState(formatDateForInput(opportunity.decisionDate));
  const [budgetConfidence, setBudgetConfidence] = useState(opportunity.budgetConfidence || '');
  const [knownCompetitors, setKnownCompetitors] = useState(opportunity.knownCompetitors || '');

  // RFP fields
  const [rfpDueDate, setRfpDueDate] = useState(formatDateForInput(opportunity.rfpDueDate));
  const [rfpDecisionDate, setRfpDecisionDate] = useState(formatDateForInput(opportunity.rfpDecisionDate));
  const [rfpLink, setRfpLink] = useState(opportunity.rfpLink || '');

  // Deal Context fields
  const [opportunityType, setOpportunityType] = useState(opportunity.opportunityType || '');
  const [dealContextExpanded, setDealContextExpanded] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stage check panel state (soft validation)
  const [pendingStage, setPendingStage] = useState<PipelineStage | 'other' | null>(null);
  const [stageCheckIssues, setStageCheckIssues] = useState<StageCheckIssue[]>([]);
  const [showStageCheck, setShowStageCheck] = useState(false);
  const [closeDateSuggested, setCloseDateSuggested] = useState(false);

  // Ref for quick-fix focus action
  const nextStepRef = useRef<HTMLTextAreaElement>(null);

  // Onboarding seeding state
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ created: number; skipped: number } | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const hasAttemptedAutoSeed = useRef(false);

  // Activity snippet expansion state
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  const daysSinceActivity = daysSince(opportunity.lastActivityAt);
  const isRfp = opportunityType?.toLowerCase().includes('rfp');
  const isWon = opportunity.stage === 'won';
  const isClosed = ['won', 'lost', 'dormant'].includes(opportunity.stage);
  const isOpen = !isClosed;

  // Track if form has unsaved changes
  const hasChanges = useMemo(() => {
    // Momentum fields
    if (nextStep !== (opportunity.nextStep || '')) return true;
    if (nextStepDue !== formatDateForInput(opportunity.nextStepDue)) return true;

    // Deal details fields
    if (stage !== opportunity.stage) return true;
    if (value !== (opportunity.value?.toString() || '')) return true;
    if (closeDate !== formatDateForInput(opportunity.closeDate)) return true;
    if (owner !== (opportunity.owner || '')) return true;
    if (source !== (opportunity.source || '')) return true;
    if (notes !== (opportunity.notes || '')) return true;
    if (deliverableName !== (opportunity.deliverableName || '')) return true;

    // Buying process fields
    if (decisionOwner !== (opportunity.decisionOwner || '')) return true;
    if (decisionDate !== formatDateForInput(opportunity.decisionDate)) return true;
    if (budgetConfidence !== (opportunity.budgetConfidence || '')) return true;
    if (knownCompetitors !== (opportunity.knownCompetitors || '')) return true;

    // RFP fields
    if (rfpDueDate !== formatDateForInput(opportunity.rfpDueDate)) return true;
    if (rfpDecisionDate !== formatDateForInput(opportunity.rfpDecisionDate)) return true;
    if (rfpLink !== (opportunity.rfpLink || '')) return true;

    // Deal Context fields
    if (opportunityType !== (opportunity.opportunityType || '')) return true;

    return false;
  }, [
    nextStep, nextStepDue, stage, value, closeDate, owner, source, notes, deliverableName,
    decisionOwner, decisionDate, budgetConfidence, knownCompetitors,
    rfpDueDate, rfpDecisionDate, rfpLink, opportunityType,
    opportunity,
  ]);

  // Validation warnings
  const showNextStepWarning = isOpen && !nextStep.trim();
  const showOverduePill = isOpen && isOverdue(nextStepDue);

  // Health explanation (read-only, never writes)
  const healthExplanation = useMemo(() => {
    return getHealthExplanation({
      dealHealth: opportunity.dealHealth,
      stage: opportunity.stage,
      nextStep: opportunity.nextStep,
      nextStepDue: opportunity.nextStepDue,
      daysSinceActivity,
      lastActivityAt: opportunity.lastActivityAt,
      isClosed,
    });
  }, [opportunity.dealHealth, opportunity.stage, opportunity.nextStep, opportunity.nextStepDue, daysSinceActivity, opportunity.lastActivityAt, isClosed]);

  const saveChanges = useCallback(async () => {
    if (isSaving || !hasChanges) return;

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage(null);

    try {
      // Parse value as number, handle empty string
      const parsedValue = value.trim() ? parseFloat(value.replace(/[^0-9.]/g, '')) : null;

      const response = await fetch(`/api/pipeline/opportunities/${opportunity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Momentum fields
          nextStep: nextStep.trim() || null,
          nextStepDue: nextStepDue || null,

          // Deal details fields
          stage: stage !== 'other' ? stage : undefined, // Don't update if 'other'
          value: parsedValue !== null && !isNaN(parsedValue) ? parsedValue : null,
          closeDate: closeDate || null,
          owner: owner.trim() || null,
          source: source.trim() || null,
          notes: notes.trim() || null,
          deliverableName: deliverableName.trim() || null,

          // Buying process fields
          decisionOwner: decisionOwner.trim() || null,
          decisionDate: decisionDate || null,
          budgetConfidence: budgetConfidence || null,
          knownCompetitors: knownCompetitors.trim() || null,

          // RFP fields
          rfpDueDate: rfpDueDate || null,
          rfpDecisionDate: rfpDecisionDate || null,
          rfpLink: rfpLink.trim() || null,

          // Deal Context fields
          opportunityType: opportunityType.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      if (data.opportunity) {
        setOpportunity(data.opportunity);
        // Also update local state to match saved values
        setStage(data.opportunity.stage);
        setOpportunityType(data.opportunity.opportunityType || '');
      }
      setSaveStatus('saved');
      setCloseDateSuggested(false); // Clear suggestion flag after save
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }, [
    opportunity.id, isSaving, hasChanges,
    nextStep, nextStepDue, stage, value, closeDate, owner, source, notes, deliverableName,
    decisionOwner, decisionDate, budgetConfidence, knownCompetitors,
    rfpDueDate, rfpDecisionDate, rfpLink, opportunityType,
  ]);

  // Dismiss error banner
  const dismissError = useCallback(() => {
    setErrorMessage(null);
    setSaveStatus('idle');
  }, []);

  // Build opportunity draft for stage validation
  const opportunityDraft: OpportunityDraft = useMemo(() => ({
    nextStep,
    nextStepDue,
    value,
    closeDate,
    decisionOwner,
  }), [nextStep, nextStepDue, value, closeDate, decisionOwner]);

  // Guarded stage change handler (soft validation with nudges)
  const handleStageChange = useCallback((newStage: PipelineStage | 'other') => {
    const issues = computeStageIssues(opportunityDraft, newStage);

    if (issues.length === 0) {
      // No issues - apply stage change directly
      setStage(newStage);
      setPendingStage(null);
      setStageCheckIssues([]);
      setShowStageCheck(false);
    } else {
      // Issues found - show soft validation panel
      setPendingStage(newStage);
      setStageCheckIssues(issues);
      setShowStageCheck(true);
    }
  }, [opportunityDraft]);

  // Apply pending stage change (user chose "Continue anyway")
  const applyPendingStage = useCallback(() => {
    if (pendingStage) {
      setStage(pendingStage);
    }
    setPendingStage(null);
    setStageCheckIssues([]);
    setShowStageCheck(false);
  }, [pendingStage]);

  // Cancel pending stage change
  const cancelStageChange = useCallback(() => {
    setPendingStage(null);
    setStageCheckIssues([]);
    setShowStageCheck(false);
  }, []);

  // Execute quick-fix action with auto-resolve
  const executeQuickFix = useCallback((action: StageCheckFixAction) => {
    switch (action) {
      case 'focus_next_step':
        // Focus the Next Step textarea - doesn't auto-resolve since user needs to type
        nextStepRef.current?.focus();
        nextStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      case 'suggest_close_date': {
        // Set close date to 30 days from now
        const suggestedDate = new Date();
        suggestedDate.setDate(suggestedDate.getDate() + 30);
        const newCloseDate = suggestedDate.toISOString().split('T')[0];
        setCloseDate(newCloseDate);
        setCloseDateSuggested(true);

        // Auto-resolve: recompute issues with updated draft
        if (pendingStage) {
          const updatedDraft: OpportunityDraft = {
            ...opportunityDraft,
            closeDate: newCloseDate,
          };
          const remainingIssues = computeStageIssues(updatedDraft, pendingStage);

          if (remainingIssues.length === 0) {
            // All issues resolved - auto-apply stage change
            setStage(pendingStage);
            setPendingStage(null);
            setStageCheckIssues([]);
            setShowStageCheck(false);
          } else {
            // Update issues list in-place
            setStageCheckIssues(remainingIssues);
          }
        }
        break;
      }
    }
  }, [opportunityDraft, pendingStage]);

  // Toggle activity snippet expansion
  const toggleActivityExpand = useCallback((activityId: string) => {
    setExpandedActivities((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  }, []);

  // Seed onboarding work items
  const seedOnboardingTasks = useCallback(async () => {
    if (isSeeding || !companyId || !opportunity.engagements?.length) return;

    const engagementId = opportunity.engagements[0]; // Use first engagement
    setIsSeeding(true);
    setSeedError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/engagements/${engagementId}/seed-onboarding`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opportunityId: opportunity.id,
            wonAt: opportunity.stageEnteredAt, // Use Won date as baseline for due dates
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed onboarding');
      }

      setSeedResult({ created: data.created, skipped: data.skipped });
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Failed to seed onboarding tasks');
    } finally {
      setIsSeeding(false);
    }
  }, [companyId, opportunity.id, opportunity.engagements, opportunity.stageEnteredAt, isSeeding]);

  // Auto-seed onboarding when Won + Engagement exists (once per page load)
  useEffect(() => {
    if (
      isWon &&
      companyId &&
      opportunity.engagements?.length &&
      !hasAttemptedAutoSeed.current &&
      !seedResult &&
      !isSeeding
    ) {
      hasAttemptedAutoSeed.current = true;
      seedOnboardingTasks();
    }
  }, [isWon, companyId, opportunity.engagements, seedResult, isSeeding, seedOnboardingTasks]);

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center justify-between gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-400">{errorMessage}</span>
          </div>
          <button
            onClick={dismissError}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link
            href="/pipeline/opportunities"
            className="text-sm text-slate-400 hover:text-slate-300 mb-2 inline-block transition-colors"
          >
            ← Opportunities
          </Link>
          {isEditingName ? (
            <input
              type="text"
              value={deliverableName}
              onChange={(e) => setDeliverableName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingName(false);
                if (e.key === 'Escape') {
                  setDeliverableName(opportunity.deliverableName || '');
                  setIsEditingName(false);
                }
              }}
              autoFocus
              className="text-2xl font-bold text-slate-100 bg-slate-800 border border-amber-500 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          ) : (
            <h1
              className="text-2xl font-bold text-slate-100 truncate cursor-pointer hover:text-amber-400 transition-colors"
              onClick={() => setIsEditingName(true)}
              title="Click to edit"
            >
              {deliverableName || opportunity.companyName}
            </h1>
          )}
          {companyName && companyId && (
            <Link
              href={`/c/${companyId}`}
              className="text-sm text-amber-500 hover:text-amber-400 mt-1 inline-block"
            >
              {companyName}
            </Link>
          )}
        </div>

        {/* Stage + Health Pills + Explanation */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Editable Stage Dropdown */}
            <div className="relative">
              <select
                value={stage}
                onChange={(e) => handleStageChange(e.target.value as PipelineStage | 'other')}
                className={`appearance-none px-3 py-1 pr-8 rounded-lg text-sm font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${getStageColorClass(
                  stage
                )}`}
              >
                {ALL_STAGES.map((s) => (
                  <option key={s} value={s} className="bg-slate-800 text-slate-200">
                    {getStageLabel(s)}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {opportunity.dealHealth && (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium border ${getDealHealthColorClasses(
                  opportunity.dealHealth
                )}`}
              >
                {getDealHealthLabel(opportunity.dealHealth)}
              </span>
            )}
          </div>
          {/* Health Explanation (read-only) */}
          {healthExplanation && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{healthExplanation}</span>
              {/*
                AI Explain link - STUBBED
                TODO: When AI infra is available, enable this link to call an AI utility
                that summarizes deal risks in 1 sentence. Must be user-initiated only.
                Example: onClick={() => fetchAIExplanation(opportunity)}
              */}
              {/* <button className="text-slate-400 hover:text-slate-300 underline">Explain</button> */}
            </div>
          )}
        </div>
      </div>

      {/* Stage Check Panel (soft validation) */}
      {showStageCheck && pendingStage && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            {/* Warning Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-amber-300">
                Stage Change Check
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Moving to <span className="text-amber-400 font-medium">{getStageLabel(pendingStage)}</span> — consider addressing these items:
              </p>

              {/* Issues List */}
              <ul className="mt-2 space-y-1">
                {stageCheckIssues.map((issue) => (
                  <li key={issue.id} className="flex items-center gap-2 text-xs">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                    <span className="text-slate-300">{issue.label}</span>
                    {issue.fixAction && (
                      <button
                        onClick={() => executeQuickFix(issue.fixAction!)}
                        className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                      >
                        {issue.fixAction === 'focus_next_step' ? 'Add now' : 'Set +30 days'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {/* Save reminder for suggested close date */}
              {closeDateSuggested && hasChanges && (
                <p className="mt-2 text-xs text-slate-500 italic">
                  Close Date updated — save to persist
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={applyPendingStage}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg border border-amber-500/30 transition-colors"
                >
                  Continue anyway
                </button>
                <button
                  onClick={cancelStageChange}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Bar */}
      <div className="flex items-center gap-6 py-3 px-4 bg-slate-900/50 border border-slate-800 rounded-xl">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">Value</div>
          <div className="text-lg font-semibold text-emerald-400">
            {formatCurrency(opportunity.value)}
          </div>
        </div>
        <div className="w-px h-8 bg-slate-700" />
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wide">Close Date</div>
          <div className="text-lg font-medium text-slate-200">
            {formatDate(opportunity.closeDate)}
          </div>
        </div>
        {opportunity.opportunityType && (
          <>
            <div className="w-px h-8 bg-slate-700" />
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Type</div>
              <div className="text-sm font-medium text-slate-300">
                {opportunity.opportunityType}
              </div>
            </div>
          </>
        )}
        {opportunity.owner && (
          <>
            <div className="w-px h-8 bg-slate-700" />
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Owner</div>
              <div className="text-sm font-medium text-slate-300">{opportunity.owner}</div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Primary Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Momentum Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Momentum
              </h2>
              <div className="flex items-center gap-2">
                {showOverduePill && (
                  <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-medium">
                    Overdue
                  </span>
                )}
                {daysSinceActivity !== null && (
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      daysSinceActivity > 14
                        ? 'bg-red-500/10 text-red-400'
                        : daysSinceActivity > 7
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {daysSinceActivity === 0
                      ? 'Active today'
                      : `${daysSinceActivity}d since activity`}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Next Step */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-400">
                    Next Step
                  </label>
                  {showNextStepWarning && (
                    <span className="text-xs text-amber-400">
                      Required to be Healthy
                    </span>
                  )}
                </div>
                <textarea
                  ref={nextStepRef}
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="What needs to happen next to move this deal forward?"
                  rows={3}
                  disabled={isClosed}
                  className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none ${
                    showNextStepWarning ? 'border-amber-500/50' : 'border-slate-700'
                  }`}
                />
              </div>

              {/* Next Step Due Date + Save Button */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={nextStepDue}
                    onChange={(e) => setNextStepDue(e.target.value)}
                    disabled={isClosed}
                    className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                      showOverduePill ? 'border-red-500/50' : 'border-slate-700'
                    }`}
                  />
                </div>
                <button
                  onClick={saveChanges}
                  disabled={isSaving || !hasChanges}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors min-w-[80px] flex items-center justify-center gap-2 ${
                    saveStatus === 'saved'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : saveStatus === 'error'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : hasChanges
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {isSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Saving</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    'Saved'
                  ) : saveStatus === 'error' ? (
                    'Error'
                  ) : (
                    'Save'
                  )}
                </button>
              </div>

              {/* Last Activity */}
              {opportunity.lastActivityAt && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-xs text-slate-500">
                    Last meaningful activity: {formatDate(opportunity.lastActivityAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RFP Section - Only for RFP Response opportunities */}
          {isRfp && (
            <div className="bg-slate-900/70 border border-purple-500/30 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wide mb-4">
                RFP Details
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">RFP Due Date</label>
                  <input
                    type="date"
                    value={rfpDueDate}
                    onChange={(e) => setRfpDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Decision Date</label>
                  <input
                    type="date"
                    value={rfpDecisionDate}
                    onChange={(e) => setRfpDecisionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">RFP Link</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={rfpLink}
                      onChange={(e) => setRfpLink(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-slate-800 border border-purple-500/30 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    {rfpLink && (
                      <a
                        href={rfpLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deal Details Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Deal Details
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Value (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Expected Close Date</label>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>
          </div>

          {/* Deal Context Card (Collapsible) */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setDealContextExpanded(!dealContextExpanded)}
              aria-expanded={dealContextExpanded}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
            >
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                Deal Context
              </h2>
              <div className="flex items-center gap-2">
                {!dealContextExpanded && (
                  <span className="text-xs text-slate-500 hidden sm:inline">
                    Owner: {owner || '—'} • Source: {source || '—'} • Type: {opportunityType || '—'} • Budget: {getBudgetConfidenceLabel(budgetConfidence)}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {dealContextExpanded ? 'Hide' : 'Show'}
                </span>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${dealContextExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {dealContextExpanded && (
              <div className="px-6 pb-6 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Opportunity Type</label>
                    <div className="relative">
                      <select
                        value={opportunityType}
                        onChange={(e) => setOpportunityType(e.target.value)}
                        className="appearance-none w-full px-3 py-2 pr-8 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
                      >
                        {OPPORTUNITY_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Opportunity Source</label>
                    <input
                      type="text"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="Referral, inbound, outreach, etc."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Opportunity Owner</label>
                    <input
                      type="text"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      placeholder="Owner name"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Decision Owner</label>
                    <input
                      type="text"
                      value={decisionOwner}
                      onChange={(e) => setDecisionOwner(e.target.value)}
                      placeholder="Name of decision maker"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Budget Confidence</label>
                    <div className="relative">
                      <select
                        value={budgetConfidence}
                        onChange={(e) => setBudgetConfidence(e.target.value)}
                        className="appearance-none w-full px-3 py-2 pr-8 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
                      >
                        {BUDGET_CONFIDENCE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Known Competitors</label>
                    <input
                      type="text"
                      value={knownCompetitors}
                      onChange={(e) => setKnownCompetitors(e.target.value)}
                      placeholder="Competitors in this deal"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Is RFP:</span>
                      <span className={`text-xs font-medium ${isRfp ? 'text-purple-400' : 'text-slate-400'}`}>
                        {isRfp ? 'Yes' : 'No'}
                      </span>
                      <span className="text-xs text-slate-600">(based on Opportunity Type)</span>
                    </div>
                  </div>
                  {isRfp && (
                    <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">RFP Link</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={rfpLink}
                          onChange={(e) => setRfpLink(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        />
                        {rfpLink && (
                          <a
                            href={rfpLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600 transition-colors flex items-center"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Buying Process Card */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Buying Process
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Decision Owner</label>
                <input
                  type="text"
                  value={decisionOwner}
                  onChange={(e) => setDecisionOwner(e.target.value)}
                  placeholder="Name of decision maker"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Decision Date</label>
                <input
                  type="date"
                  value={decisionDate}
                  onChange={(e) => setDecisionDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Budget Confidence</label>
                <div className="relative">
                  <select
                    value={budgetConfidence}
                    onChange={(e) => setBudgetConfidence(e.target.value)}
                    className="appearance-none w-full px-3 py-2 pr-8 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 cursor-pointer"
                  >
                    {BUDGET_CONFIDENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Known Competitors</label>
                <input
                  type="text"
                  value={knownCompetitors}
                  onChange={(e) => setKnownCompetitors(e.target.value)}
                  placeholder="Competitors in this deal"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this opportunity..."
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
            />
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Actions
            </h2>
            <div className="space-y-2">
              {companyId && (
                <Link
                  href={`/c/${companyId}/blueprint`}
                  className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  Run GAP Assessment
                </Link>
              )}
              {!isClosed && (
                <MarkWonButton
                  opportunityId={opportunity.id}
                  hasEngagements={!!(opportunity.engagements && opportunity.engagements.length > 0)}
                  variant="secondary"
                />
              )}
            </div>
          </div>

          {/* Engagement Section - Only for Won deals */}
          {isWon && (
            <div className="bg-slate-900/70 border border-emerald-500/30 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide mb-4">
                Engagement
              </h2>
              {opportunity.engagements && opportunity.engagements.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm font-medium">
                      {opportunity.engagements.length} Engagement
                      {opportunity.engagements.length > 1 ? 's' : ''} Active
                    </span>
                  </div>

                  {/* Onboarding Seeding - Auto-seeds on load, button is fallback */}
                  <div className="pt-3 border-t border-emerald-500/20">
                    {isSeeding ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-sm">Seeding onboarding tasks...</span>
                      </div>
                    ) : seedResult ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm">
                            {seedResult.created > 0
                              ? `Onboarding seeded (${seedResult.created} tasks)`
                              : 'Onboarding already seeded'}
                          </span>
                        </div>
                        {seedResult.skipped > 0 && seedResult.created > 0 && (
                          <span className="text-xs text-slate-500">
                            ({seedResult.skipped} already existed)
                          </span>
                        )}
                        {companyId && (
                          <Link
                            href={`/c/${companyId}/work`}
                            className="text-xs text-amber-500 hover:text-amber-400 inline-flex items-center gap-1"
                          >
                            View in Work Queue
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    ) : seedError ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm">{seedError}</span>
                        </div>
                        <button
                          onClick={seedOnboardingTasks}
                          className="w-full px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-medium rounded-lg border border-emerald-500/30 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Retry Onboarding Setup</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400">
                  <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm">Engagement pending...</span>
                </div>
              )}
            </div>
          )}

          {/* Company Card */}
          {companyId && companyName && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Company
              </h2>
              <Link
                href={`/c/${companyId}`}
                className="block hover:bg-slate-800/50 rounded-lg p-3 -m-3 transition-colors"
              >
                <div className="text-slate-200 font-medium">{companyName}</div>
                {companyDomain && <div className="text-xs text-slate-500 mt-1">{companyDomain}</div>}
              </Link>
            </div>
          )}

          {/* Activities Timeline */}
          {activities.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
                Recent Activity
              </h2>
              <div className="space-y-3">
                {activities.slice(0, 10).map((activity) => {
                  const openUrl = getActivityOpenUrl(activity);
                  const isExpanded = expandedActivities.has(activity.id);
                  // Only show toggle if snippet is long enough to be clamped (~80+ chars)
                  const showToggle = activity.snippet && activity.snippet.length > 80;

                  return (
                    <div key={activity.id} className="p-3 -mx-3 rounded-lg hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-start gap-3">
                        {/* Direction indicator */}
                        <div
                          className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${
                            activity.direction === 'inbound' ? 'bg-blue-400' : 'bg-emerald-400'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          {/* Subject / Title - clickable if URL exists */}
                          {openUrl ? (
                            <a
                              href={openUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-slate-200 truncate block hover:text-amber-400 transition-colors"
                            >
                              {activity.subject || getActivityTypeLabel(activity.type)}
                            </a>
                          ) : (
                            <div className="text-sm text-slate-200 truncate">
                              {activity.subject || getActivityTypeLabel(activity.type)}
                            </div>
                          )}
                          {/* Meta row */}
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span
                              className={`px-1.5 py-0.5 rounded border ${getActivityDirectionColorClasses(
                                activity.direction
                              )}`}
                            >
                              {activity.direction === 'inbound' ? 'In' : 'Out'}
                            </span>
                            {activity.fromName && (
                              <span className="truncate max-w-[120px]">{activity.fromName}</span>
                            )}
                            <span className="text-slate-600">·</span>
                            <span>
                              {new Date(activity.receivedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          {/* Snippet preview with expand/collapse */}
                          {activity.snippet && (
                            <div className="mt-1">
                              <div
                                className={`text-xs text-slate-500 ${
                                  isExpanded ? '' : 'line-clamp-2'
                                }`}
                              >
                                {activity.snippet}
                              </div>
                              {showToggle && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleActivityExpand(activity.id);
                                  }}
                                  className="text-xs text-slate-400 hover:text-slate-300 mt-1 transition-colors"
                                >
                                  {isExpanded ? 'Show less' : 'Show more'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {/* External link icon */}
                        {openUrl && (
                          <a
                            href={openUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 mt-0.5 text-slate-600 hover:text-slate-400 transition-colors"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {activities.length > 10 && (
                <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                  <span className="text-xs text-slate-500">
                    +{activities.length - 10} more activities
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Activities / Thread Link */}
          {(() => {
            // Determine best link and label
            let href: string;
            let label: string;
            let isPrimary = false;

            if (opportunity.externalThreadUrl) {
              href = opportunity.externalThreadUrl;
              label = 'Open thread';
              isPrimary = true;
            } else if (opportunity.gmailThreadId) {
              href = `https://mail.google.com/mail/u/0/#inbox/${opportunity.gmailThreadId}`;
              label = 'Open in Gmail';
              isPrimary = true;
            } else {
              href = `https://airtable.com/appXYZ/tblLeadTracker/${opportunity.id}`;
              label = 'View in Airtable';
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between gap-2 px-4 py-2 text-sm rounded-xl transition-colors ${
                  isPrimary
                    ? 'text-slate-200 bg-slate-800 border border-slate-700 hover:border-slate-600'
                    : 'text-slate-400 hover:text-slate-300 bg-slate-900/50 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{label}</span>
                  {opportunity.activitiesCount != null && opportunity.activitiesCount > 0 && (
                    <span className="text-xs text-slate-500">
                      ({opportunity.activitiesCount} {opportunity.activitiesCount === 1 ? 'activity' : 'activities'})
                    </span>
                  )}
                </div>
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
