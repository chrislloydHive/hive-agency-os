'use client';

// app/c/[companyId]/strategy/StrategyWorkspaceV4Client.tsx
// Strategy Workspace V4.2 Client Component
//
// TWO VIEW MODES:
// 1. "builder" (default) - AI Strategy Builder - single column, AI-forward
// 2. "workspace" - Advanced 3-column layout with artifacts
//
// Builder Mode (default):
// - Single column, low cognitive load
// - AI Propose is the primary action
// - Strategy snapshot visible immediately
// - Artifacts/tools hidden unless expanded
//
// Workspace Mode (advanced):
// - Left: Inputs (Context, Competition, Hive Brain summaries)
// - Center: Working Area (Strategy Artifacts with guided starters)
// - Right: Canonical Strategy (provenance metadata)

import { useState, useCallback, useMemo, useEffect, createContext, useContext } from 'react';
import {
  Loader2,
  AlertCircle,
  Target,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  FileText,
  Brain,
  Users,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Clock,
  Archive,
  TrendingUp,
  Shield,
  AlertTriangle,
  Link2,
  Unlink,
  Info,
  Sparkles,
  Layers,
  GitMerge,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Compass,
  Zap,
  RefreshCw,
  PlusCircle,
  Wand2,
  X,
  ExternalLink,
  Settings2,
  Play,
  Lock,
  Unlock,
} from 'lucide-react';
import type { CompanyStrategy, StrategyObjective, StrategyPlay, StrategyFrame } from '@/lib/types/strategy';
import { getObjectiveText } from '@/lib/types/strategy';
import { StrategyBlueprint } from '@/components/os/strategy/StrategyBlueprint';
import { StrategicFrameEditor } from '@/components/os/strategy/StrategicFrameEditor';
import { StrategyCommandCenter } from '@/components/os/strategy/StrategyCommandCenter';
import type {
  StrategyArtifact,
  StrategyArtifactType,
  StrategyArtifactStatus,
} from '@/lib/types/strategyArtifact';
import {
  ARTIFACT_TYPE_LABELS,
  ARTIFACT_STATUS_LABELS,
  ARTIFACT_STATUS_COLORS,
  canEditArtifact,
  canPromoteArtifact,
} from '@/lib/types/strategyArtifact';
import type { StrategyInputs } from '@/lib/os/strategy/strategyInputsHelpers';
import {
  computeStrategyReadiness,
  getContextDeepLink,
  getHiveBrainLink,
  type StrategyReadiness,
} from '@/lib/os/strategy/strategyInputsHelpers';
import { DiffPreview } from '@/components/ui/DiffPreview';
import Link from 'next/link';

// ============================================================================
// Strategy Guidance Context
// ============================================================================

const GUIDANCE_STORAGE_KEY = 'hive-strategy-guidance-enabled';
const VIEW_MODE_STORAGE_KEY = 'hive-strategy-view-mode';

// ============================================================================
// View Mode Types
// ============================================================================

type StrategyViewMode = 'command' | 'builder' | 'workspace';

interface ViewModeContextValue {
  viewMode: StrategyViewMode;
  setViewMode: (mode: StrategyViewMode) => void;
}

// ============================================================================
// Guidance Context
// ============================================================================

interface GuidanceContextValue {
  showGuidance: boolean;
  toggleGuidance: () => void;
}

const GuidanceContext = createContext<GuidanceContextValue>({
  showGuidance: true,
  toggleGuidance: () => {},
});

function useGuidance() {
  return useContext(GuidanceContext);
}

function useGuidanceState(): GuidanceContextValue {
  const [showGuidance, setShowGuidance] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUIDANCE_STORAGE_KEY);
      if (stored !== null) {
        setShowGuidance(stored === 'true');
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const toggleGuidance = useCallback(() => {
    setShowGuidance(prev => {
      const next = !prev;
      try {
        localStorage.setItem(GUIDANCE_STORAGE_KEY, String(next));
      } catch {
        // localStorage not available
      }
      return next;
    });
  }, []);

  return { showGuidance, toggleGuidance };
}

// ============================================================================
// Strategy Proposal Type (for safe AI updates)
// ============================================================================

interface StrategyProposal {
  proposedTitle?: string;
  proposedSummary?: string;
  proposedPillars?: Array<{ title: string; services?: string[] }>;
  assumptions?: string[];
  unknowns?: string[];
  dependencies?: string[];
  generatedAt: string;
}

// ============================================================================
// View Mode Hook
// ============================================================================

function useViewMode(): ViewModeContextValue {
  const [viewMode, setViewModeState] = useState<StrategyViewMode>('command');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === 'command' || stored === 'builder' || stored === 'workspace') {
        setViewModeState(stored);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const setViewMode = useCallback((mode: StrategyViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // localStorage not available
    }
  }, []);

  return { viewMode, setViewMode };
}

// ============================================================================
// Artifact Type Hints (for guidance)
// ============================================================================

const ARTIFACT_TYPE_HINTS: Record<StrategyArtifactType, string> = {
  draft_strategy: 'Synthesize your thinking into a cohesive strategic direction',
  growth_option: 'Explore potential growth levers before committing',
  channel_plan: 'Define how you will reach your audience',
  assumptions: 'Make beliefs explicit so they can be validated',
  risk_analysis: 'Identify what could go wrong and plan mitigations',
  synthesis: 'Combine insights from multiple artifacts',
};

// ============================================================================
// Artifact Starter Templates
// ============================================================================

interface ArtifactStarter {
  type: StrategyArtifactType;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultTitle: string;
  template: string;
}

const ARTIFACT_STARTERS: ArtifactStarter[] = [
  {
    type: 'growth_option',
    label: 'Growth Option',
    description: 'Explore a specific growth opportunity',
    icon: <TrendingUp className="w-4 h-4" />,
    defaultTitle: 'Growth Option: [Name]',
    template: `## Growth Option

### Opportunity
_What is the growth opportunity?_

### Target Audience
_Who would this serve?_

### Expected Impact
- Revenue potential:
- Timeline:
- Confidence level:

### Requirements
_What would we need to execute?_

### Risks
_What could go wrong?_

### Next Steps
- [ ] Validate assumption 1
- [ ] Research competitor approaches
- [ ] Estimate resource requirements`,
  },
  {
    type: 'draft_strategy',
    label: 'Draft Strategy',
    description: 'Outline a complete strategic direction',
    icon: <Target className="w-4 h-4" />,
    defaultTitle: 'Draft Strategy: [Focus Area]',
    template: `## Strategic Direction

### Vision
_Where are we trying to go?_

### Core Pillars
1. **Pillar 1**: _Description_
2. **Pillar 2**: _Description_
3. **Pillar 3**: _Description_

### Key Objectives
- Objective 1:
- Objective 2:
- Objective 3:

### Success Metrics
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
|        |         |        |          |

### Dependencies
_What needs to be true for this to work?_`,
  },
  {
    type: 'assumptions',
    label: 'Key Assumptions',
    description: 'Document what we believe to be true',
    icon: <Lightbulb className="w-4 h-4" />,
    defaultTitle: 'Key Assumptions',
    template: `## Key Assumptions

### Market Assumptions
- [ ] _Assumption about market size/dynamics_
- [ ] _Assumption about customer behavior_
- [ ] _Assumption about competition_

### Business Assumptions
- [ ] _Assumption about our capabilities_
- [ ] _Assumption about resources_
- [ ] _Assumption about timeline_

### Validation Status
| Assumption | Confidence | Evidence | Needs Validation |
|------------|------------|----------|------------------|
|            | High/Med/Low |        | Yes/No           |

### Critical Unknowns
_What do we need to learn?_

### How to Validate
1. _Validation approach 1_
2. _Validation approach 2_`,
  },
  {
    type: 'risk_analysis',
    label: 'Risks & Tradeoffs',
    description: 'Identify risks and document tradeoffs',
    icon: <Shield className="w-4 h-4" />,
    defaultTitle: 'Risks & Tradeoffs Analysis',
    template: `## Risks & Tradeoffs

### High-Priority Risks
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
|      | High/Med/Low | High/Med/Low |    |

### Strategic Tradeoffs
#### Option A vs Option B
- **Choosing A means:** _consequences_
- **Choosing B means:** _consequences_
- **Recommendation:** _which and why_

### Dependencies & Blockers
- _Dependency 1_
- _Dependency 2_

### Contingency Plans
**If [risk] occurs:**
- Immediate action:
- Fallback plan:

### Decision Log
| Decision | Date | Rationale |
|----------|------|-----------|
|          |      |           |`,
  },
];

// ============================================================================
// Types
// ============================================================================

interface StrategyWorkspaceV4Props {
  companyId: string;
  companyName: string;
  initialStrategy: CompanyStrategy | null;
  initialArtifacts: StrategyArtifact[];
  strategyInputs: StrategyInputs;
  /** Force advanced/workspace mode (opt-in via ?mode=advanced) */
  forceAdvanced?: boolean;
}

interface ArtifactFormData {
  type: StrategyArtifactType;
  title: string;
  content: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategyWorkspaceV4Client({
  companyId,
  companyName,
  initialStrategy,
  initialArtifacts,
  strategyInputs,
  forceAdvanced = false,
}: StrategyWorkspaceV4Props) {
  const [strategy, setStrategy] = useState<CompanyStrategy | null>(initialStrategy);
  const [artifacts, setArtifacts] = useState<StrategyArtifact[]>(initialArtifacts);
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState<StrategyArtifact | null>(null);

  // AI Tools state
  const [aiToolLoading, setAiToolLoading] = useState<string | null>(null); // 'options' | 'assumptions' | 'synthesize'

  // AI Prefill state
  const [prefillLoadingId, setPrefillLoadingId] = useState<string | null>(null);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  // Guidance state
  const guidance = useGuidanceState();

  // View mode - uses hook for persistence, but forceAdvanced can override to workspace
  const { viewMode: storedViewMode, setViewMode } = useViewMode();
  const viewMode: StrategyViewMode = forceAdvanced ? 'workspace' : storedViewMode;

  // Builder-specific state
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [aiProposalLoading, setAiProposalLoading] = useState(false);
  const [showProposalPreview, setShowProposalPreview] = useState(false);

  // Proposal state (safe-by-default: AI generates proposal, user must apply)
  const [proposal, setProposal] = useState<StrategyProposal | null>(null);

  // Inline editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [isEditingPriorities, setIsEditingPriorities] = useState(false);
  const [editedPriorities, setEditedPriorities] = useState<string[]>([]);
  const [savingField, setSavingField] = useState<'title' | 'summary' | 'priorities' | null>(null);
  const [savedField, setSavedField] = useState<'title' | 'summary' | 'priorities' | null>(null);

  // Finalize state
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Details drawer state
  const [detailsDrawerSection, setDetailsDrawerSection] = useState<
    'businessReality' | 'constraints' | 'competition' | 'executionCapabilities' | null
  >(null);

  // AI Improve state (for left panel sections)
  const [aiImprovingSection, setAiImprovingSection] = useState<
    'businessReality' | 'constraints' | 'competition' | 'executionCapabilities' | null
  >(null);

  // Compute Strategy Readiness
  const strategyReadiness = useMemo(() => {
    return computeStrategyReadiness(strategyInputs);
  }, [strategyInputs]);

  // Refresh artifacts
  const refreshArtifacts = useCallback(async () => {
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/artifacts`);
      const data = await response.json();
      if (data.artifacts) {
        setArtifacts(data.artifacts);
      }
    } catch (err) {
      console.error('[V4Workspace] Failed to refresh artifacts:', err);
    }
  }, [companyId]);

  // Create artifact
  const handleCreateArtifact = useCallback(async (formData: ArtifactFormData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          title: formData.title,
          content: formData.content,
          source: 'human',
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to create artifact');
      }
      await refreshArtifacts();
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create artifact');
    } finally {
      setLoading(false);
    }
  }, [companyId, refreshArtifacts]);

  // Update artifact
  const handleUpdateArtifact = useCallback(async (
    artifactId: string,
    updates: Partial<Pick<StrategyArtifact, 'title' | 'content' | 'status'>>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/artifacts/${artifactId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to update artifact');
      }
      await refreshArtifacts();
      setEditingArtifact(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update artifact');
    } finally {
      setLoading(false);
    }
  }, [companyId, refreshArtifacts]);

  // Delete artifact
  const handleDeleteArtifact = useCallback(async (artifactId: string) => {
    if (!confirm('Are you sure you want to delete this artifact?')) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/artifacts/${artifactId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to delete artifact');
      }
      setSelectedArtifactIds(prev => {
        const next = new Set(prev);
        next.delete(artifactId);
        return next;
      });
      await refreshArtifacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete artifact');
    } finally {
      setLoading(false);
    }
  }, [companyId, refreshArtifacts]);

  // Promote selected artifacts to canonical strategy
  const handlePromote = useCallback(async () => {
    if (selectedArtifactIds.size === 0) {
      setError('Select at least one artifact to promote');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactIds: Array.from(selectedArtifactIds),
          title: `Strategy from ${selectedArtifactIds.size} artifact${selectedArtifactIds.size > 1 ? 's' : ''}`,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to promote artifacts');
      }
      if (data.strategy) {
        setStrategy(data.strategy);
      }
      setSelectedArtifactIds(new Set());
      await refreshArtifacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote artifacts');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedArtifactIds, refreshArtifacts]);

  // Toggle artifact selection
  const toggleArtifactSelection = useCallback((artifactId: string) => {
    setSelectedArtifactIds(prev => {
      const next = new Set(prev);
      if (next.has(artifactId)) {
        next.delete(artifactId);
      } else {
        next.add(artifactId);
      }
      return next;
    });
  }, []);

  // Create artifact from starter template WITH AI Prefill
  const handleStarterCreate = useCallback(async (starter: ArtifactStarter) => {
    setLoading(true);
    setError(null);
    setPrefillError(null);

    try {
      // Step 1: Create artifact immediately with "Generating..." placeholder
      const createResponse = await fetch(`/api/os/companies/${companyId}/strategy/artifacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: starter.type,
          title: `${starter.label}: Generating...`,
          content: '_Generating AI-powered starting point..._\n\nThis artifact will be populated with a customized draft based on your company context.',
          source: 'ai_tool', // Mark as AI source since we're prefilling
        }),
      });
      const createData = await createResponse.json();
      if (!createResponse.ok || createData.error) {
        throw new Error(createData.error || 'Failed to create artifact');
      }

      const newArtifact = createData.artifact;
      await refreshArtifacts();

      // Step 2: Call prefill API to generate content
      setPrefillLoadingId(newArtifact.id);

      const prefillResponse = await fetch(
        `/api/os/companies/${companyId}/strategy/artifacts/${newArtifact.id}/prefill`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const prefillData = await prefillResponse.json();

      if (!prefillResponse.ok || prefillData.error) {
        // Prefill failed - update artifact with template fallback
        console.warn('[handleStarterCreate] Prefill failed, using template:', prefillData.error);
        setPrefillError(prefillData.error || 'AI generation failed');

        // Update artifact with template instead
        await fetch(
          `/api/os/companies/${companyId}/strategy/artifacts/${newArtifact.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: starter.defaultTitle,
              content: starter.template,
            }),
          }
        );
        await refreshArtifacts();

        // Still open the editor with template content
        setEditingArtifact({
          ...newArtifact,
          title: starter.defaultTitle,
          content: starter.template,
          source: 'human', // Revert to human since prefill failed
        });
      } else {
        // Prefill succeeded
        await refreshArtifacts();

        // Open the edit modal with prefilled content
        setEditingArtifact({
          ...newArtifact,
          title: prefillData.title,
          content: prefillData.contentMarkdown,
          source: 'ai_tool',
          generatedBy: 'ai_prefill',
          generatedAt: new Date().toISOString(),
          generationInputs: prefillData.generationInputs,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create artifact');
    } finally {
      setLoading(false);
      setPrefillLoadingId(null);
    }
  }, [companyId, refreshArtifacts]);

  // ============================================================================
  // AI Tools Handlers
  // ============================================================================

  // AI Tool: Generate Options
  const handleAIGenerateOptions = useCallback(async () => {
    setAiToolLoading('options');
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/ai-tools/generate-options`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate options');
      }
      await refreshArtifacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate options');
    } finally {
      setAiToolLoading(null);
    }
  }, [companyId, refreshArtifacts]);

  // AI Tool: Map Assumptions & Risks
  const handleAIMapAssumptions = useCallback(async () => {
    if (selectedArtifactIds.size === 0) {
      setError('Select at least one artifact for assumption mapping');
      return;
    }
    setAiToolLoading('assumptions');
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/ai-tools/map-assumptions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifactIds: Array.from(selectedArtifactIds),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to map assumptions');
      }
      await refreshArtifacts();
      setSelectedArtifactIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to map assumptions');
    } finally {
      setAiToolLoading(null);
    }
  }, [companyId, selectedArtifactIds, refreshArtifacts]);

  // AI Tool: Synthesize Strategy
  const handleAISynthesize = useCallback(async () => {
    if (selectedArtifactIds.size < 2) {
      setError('Select at least 2 artifacts to synthesize');
      return;
    }
    setAiToolLoading('synthesize');
    setError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/ai-tools/synthesize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifactIds: Array.from(selectedArtifactIds),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to synthesize strategy');
      }
      await refreshArtifacts();
      setSelectedArtifactIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to synthesize strategy');
    } finally {
      setAiToolLoading(null);
    }
  }, [companyId, selectedArtifactIds, refreshArtifacts]);

  // AI Improve handler for left panel sections
  // Opens proposal drawer in Context page with AI assist
  const handleAIImprove = useCallback(async (
    section: 'businessReality' | 'constraints' | 'competition' | 'executionCapabilities'
  ) => {
    setAiImprovingSection(section);
    try {
      // Navigate to Context page with AI assist panel open for this section
      // For now, we'll just open the context page with the section anchor + ai-assist param
      const sectionAnchors: Record<typeof section, string> = {
        businessReality: 'identity',
        constraints: 'constraints',
        competition: 'competitive',
        executionCapabilities: 'capabilities',
      };
      const contextUrl = `/c/${companyId}/context?ai-assist=${sectionAnchors[section]}#${sectionAnchors[section]}`;
      window.location.href = contextUrl;
    } catch (err) {
      console.error('[handleAIImprove] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start AI assist');
    } finally {
      setAiImprovingSection(null);
    }
  }, [companyId]);

  // Filter artifacts by promotability
  const promotableArtifacts = artifacts.filter(a => canPromoteArtifact(a));
  const promotedArtifacts = artifacts.filter(a => a.status === 'promoted');

  // Compute which artifacts are included in canonical strategy
  const includedArtifactIds = useMemo(() => {
    return new Set(strategy?.sourceArtifactIds || []);
  }, [strategy?.sourceArtifactIds]);

  // Compute artifact counts by type for provenance
  const artifactCountsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    if (strategy?.sourceArtifactIds) {
      for (const id of strategy.sourceArtifactIds) {
        const artifact = artifacts.find(a => a.id === id);
        if (artifact) {
          counts[artifact.type] = (counts[artifact.type] || 0) + 1;
        }
      }
    }
    return counts;
  }, [strategy?.sourceArtifactIds, artifacts]);

  // Check which inputs are used in strategy
  const inputsUsed = useMemo(() => ({
    context: !!strategy?.baseContextRevisionId,
    competition: !!strategy?.competitionSourceUsed,
    hiveBrain: !!strategy?.hiveBrainRevisionId,
  }), [strategy]);

  // Available inputs for AI Propose
  const availableInputs = useMemo(() => ({
    context: strategyReadiness.completenessPercent > 0,
    competition: !!strategyInputs.competition?.competitors?.length,
    websiteLab: !!strategyInputs.meta.lastUpdatedAt,
  }), [strategyReadiness, strategyInputs]);

  // AI Propose Strategy handler (Builder mode primary action)
  // SAFE-BY-DEFAULT: Generates proposal, does NOT directly overwrite canonical strategy
  const handleAIImproveStrategy = useCallback(async () => {
    setAiProposalLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/os/strategy/ai-propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate strategy proposal');
      }
      // Store as proposal - DO NOT overwrite canonical strategy
      if (data.strategy) {
        setProposal({
          proposedTitle: data.strategy.title,
          proposedSummary: data.strategy.summary,
          proposedPillars: data.strategy.pillars?.slice(0, 3).map((p: { title: string; services?: string[] }) => ({
            title: p.title,
            services: p.services?.slice(0, 2) || [],
          })) || [],
          assumptions: data.assumptions || [],
          unknowns: data.unknowns || [],
          dependencies: data.dependencies || [],
          generatedAt: new Date().toISOString(),
        });
        setShowProposalPreview(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate strategy proposal');
    } finally {
      setAiProposalLoading(false);
    }
  }, [companyId]);

  // Apply proposal to canonical strategy
  const handleApplyProposal = useCallback(async () => {
    if (!proposal || !strategy?.id) return;
    setSavingField('summary');
    setError(null);
    try {
      // Build updates object with all proposed changes
      const updates: Record<string, unknown> = {};
      if (proposal.proposedTitle) updates.title = proposal.proposedTitle;
      if (proposal.proposedSummary) updates.summary = proposal.proposedSummary;

      // Map proposed pillars to canonical pillar structure
      if (proposal.proposedPillars && proposal.proposedPillars.length > 0) {
        // Merge with existing pillars or create new ones
        const updatedPillars = proposal.proposedPillars.map((proposed, idx) => {
          const existing = strategy.pillars?.[idx];
          return {
            ...existing,
            title: proposed.title,
            services: proposed.services || existing?.services || [],
          };
        });
        updates.pillars = updatedPillars;
      }

      const response = await fetch(`/api/os/strategy/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          updates,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to apply proposal');
      }
      if (data.strategy) {
        setStrategy(data.strategy);
      }
      setProposal(null);
      setShowProposalPreview(false);
      setSavedField('summary');
      setTimeout(() => setSavedField(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply proposal');
    } finally {
      setSavingField(null);
    }
  }, [proposal, strategy?.id, strategy?.pillars]);

  // Discard proposal
  const handleDiscardProposal = useCallback(() => {
    setProposal(null);
    setShowProposalPreview(false);
  }, []);

  // Save title inline edit
  const handleSaveTitle = useCallback(async () => {
    if (!strategy?.id) return;
    setSavingField('title');
    setError(null);
    try {
      const response = await fetch(`/api/os/strategy/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          updates: { title: editedTitle },
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save title');
      }
      if (data.strategy) {
        setStrategy(data.strategy);
      }
      setIsEditingTitle(false);
      setSavedField('title');
      setTimeout(() => setSavedField(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save title');
    } finally {
      setSavingField(null);
    }
  }, [strategy?.id, editedTitle]);

  // Save summary inline edit
  const handleSaveSummary = useCallback(async () => {
    if (!strategy?.id) return;
    setSavingField('summary');
    setError(null);
    try {
      const response = await fetch(`/api/os/strategy/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          updates: { summary: editedSummary },
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save summary');
      }
      if (data.strategy) {
        setStrategy(data.strategy);
      }
      setIsEditingSummary(false);
      setSavedField('summary');
      setTimeout(() => setSavedField(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save summary');
    } finally {
      setSavingField(null);
    }
  }, [strategy?.id, editedSummary]);

  // Save priorities inline edit
  const handleSavePriorities = useCallback(async () => {
    if (!strategy?.id) return;
    setSavingField('priorities');
    setError(null);
    try {
      // Map edited priority titles back to pillars structure
      const updatedPillars = strategy.pillars?.map((pillar, idx) => ({
        ...pillar,
        title: idx < editedPriorities.length ? editedPriorities[idx] : pillar.title,
      })) || [];

      const response = await fetch(`/api/os/strategy/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          updates: { pillars: updatedPillars },
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save priorities');
      }
      if (data.strategy) {
        setStrategy(data.strategy);
      }
      setIsEditingPriorities(false);
      setSavedField('priorities');
      setTimeout(() => setSavedField(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save priorities');
    } finally {
      setSavingField(null);
    }
  }, [strategy?.id, strategy?.pillars, editedPriorities]);

  // Handle finalize
  const handleFinalize = useCallback(async () => {
    if (!strategy?.id) return;
    setFinalizing(true);
    setError(null);
    try {
      const response = await fetch(`/api/os/strategy/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyId: strategy.id }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to finalize strategy');
      }
      if (data.strategy) {
        setStrategy(data.strategy);
      }
      setShowFinalizeConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize strategy');
    } finally {
      setFinalizing(false);
    }
  }, [strategy?.id]);

  // Generic strategy update handler (for Blueprint: objectives, pillars, plays)
  const handleUpdateStrategy = useCallback(async (updates: Partial<CompanyStrategy>) => {
    if (!strategy?.id) return;
    setError(null);
    try {
      const response = await fetch(`/api/os/strategy/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          updates,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to update strategy');
      }
      if (data.strategy) {
        setStrategy(data.strategy);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update strategy');
      throw err; // Re-throw so the editor component can handle it
    }
  }, [strategy?.id]);

  // Generate work from plays
  const handleGenerateWork = useCallback(async (playIds: string[]) => {
    if (!strategy?.id || playIds.length === 0) return;
    setError(null);
    try {
      const response = await fetch(`/api/os/strategy/generate-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          playIds,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate work');
      }
      // Optionally refresh strategy if plays were updated with work counts
      if (data.strategy) {
        setStrategy(data.strategy);
      }
      // TODO: Show success message or redirect to work page
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate work');
      throw err;
    }
  }, [strategy?.id]);

  // Update strategic frame
  const handleUpdateFrame = useCallback(async (frame: StrategyFrame) => {
    if (!strategy?.id) return;
    await handleUpdateStrategy({ strategyFrame: frame });
  }, [strategy?.id, handleUpdateStrategy]);

  // AI Fill Frame
  const handleAiFillFrame = useCallback(async (): Promise<StrategyFrame | null> => {
    try {
      const response = await fetch('/api/os/strategy/ai-fill-frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate frame suggestions');
      }
      return data.suggestedFrame;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate frame suggestions');
      return null;
    }
  }, [companyId]);

  // Can finalize check
  const canFinalize = useMemo(() => {
    return (
      strategy?.id &&
      strategy?.status !== 'finalized' &&
      !proposal && // No pending proposal
      strategyReadiness.completenessPercent >= 70 // Inputs threshold
    );
  }, [strategy?.id, strategy?.status, proposal, strategyReadiness.completenessPercent]);

  const finalizeDisabledReason = useMemo(() => {
    if (proposal) return 'Resolve proposal before finalizing';
    if (strategyReadiness.completenessPercent < 70) return 'Complete inputs (70%+) before finalizing';
    return null;
  }, [proposal, strategyReadiness.completenessPercent]);

  // Get top 3 priorities/pillars from strategy
  const topPriorities = useMemo(() => {
    if (!strategy?.pillars?.length) return [];
    return strategy.pillars.slice(0, 3).map(p => ({
      title: p.title,
      services: p.services?.slice(0, 2) || [],
    }));
  }, [strategy?.pillars]);

  // Get missing inputs for Builder banner (with deep links)
  const missingInputsWithLinks = useMemo(() => {
    const missing: Array<{ label: string; href: string }> = [];
    if (!strategyInputs.businessReality?.primaryOffering) {
      missing.push({
        label: 'Primary offering',
        href: getContextDeepLink(companyId, 'businessReality'),
      });
    }
    if (!strategyInputs.businessReality?.icpDescription) {
      missing.push({
        label: 'ICP description',
        href: getContextDeepLink(companyId, 'businessReality'),
      });
    }
    if (!strategyInputs.businessReality?.valueProposition) {
      missing.push({
        label: 'Value proposition',
        href: getContextDeepLink(companyId, 'businessReality'),
      });
    }
    return missing.slice(0, 3);
  }, [strategyInputs, companyId]);

  // ============================================================================
  // Handler for Command Center updates
  // ============================================================================
  const handleCommandCenterUpdate = useCallback(async (updates: Partial<CompanyStrategy>) => {
    if (!strategy?.id) {
      // Create new strategy if none exists
      try {
        setLoading(true);
        const res = await fetch('/api/os/strategy/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            ...updates,
          }),
        });
        if (!res.ok) throw new Error('Failed to create strategy');
        const data = await res.json();
        setStrategy(data.strategy);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create strategy');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Update existing strategy
    try {
      setLoading(true);
      const res = await fetch('/api/os/strategy/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: strategy.id,
          updates: {
            ...updates,
            lastHumanUpdatedAt: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to update strategy');
      const data = await res.json();
      setStrategy(data.strategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update strategy');
    } finally {
      setLoading(false);
    }
  }, [strategy?.id, companyId]);

  // Handler for generating tactics
  const handleGenerateTactics = useCallback(async () => {
    // TODO: Implement AI tactic generation
    console.log('[StrategyWorkspace] Generate tactics requested');
  }, []);

  // Handler for generating work from plays
  const handleGenerateWorkFromPlays = useCallback(async (playIds: string[]) => {
    if (!strategy?.id || playIds.length === 0) return;
    try {
      await handleGenerateWork(playIds);
    } catch (err) {
      console.error('[StrategyWorkspace] Generate work failed:', err);
    }
  }, [strategy?.id, handleGenerateWork]);

  // ============================================================================
  // COMMAND VIEW (3-column Objectives → Strategy → Tactics)
  // ============================================================================
  if (viewMode === 'command') {
    return (
      <GuidanceContext.Provider value={guidance}>
        <div className="space-y-4">
          {/* Dev marker */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-purple-400 border border-purple-800 bg-purple-950/50 rounded px-2 py-1">
              <Compass className="w-3 h-3" />
              Strategy UI: Command Center V5
            </div>
          )}

          {/* View Mode Toggle (subtle, top-right) */}
          <div className="flex justify-end">
            <div className="inline-flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('command')}
                className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md"
                title="Command Center"
              >
                <Compass className="w-3 h-3 inline mr-1" />
                Command
              </button>
              <button
                onClick={() => setViewMode('builder')}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 rounded-md"
                title="AI Builder"
              >
                <Sparkles className="w-3 h-3 inline mr-1" />
                AI Builder
              </button>
              <button
                onClick={() => setViewMode('workspace')}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 rounded-md"
                title="Artifacts & Deep Work"
              >
                <Layers className="w-3 h-3 inline mr-1" />
                Artifacts
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Strategy Command Center */}
          <StrategyCommandCenter
            companyId={companyId}
            strategy={strategy}
            strategyInputs={strategyInputs}
            onUpdateStrategy={handleCommandCenterUpdate}
            onGenerateTactics={handleGenerateTactics}
            onGenerateWork={handleGenerateWorkFromPlays}
          />
        </div>
      </GuidanceContext.Provider>
    );
  }

  // ============================================================================
  // BUILDER VIEW (single column, AI-forward)
  // ============================================================================
  if (viewMode === 'builder') {
    return (
      <GuidanceContext.Provider value={guidance}>
      <div className="space-y-4 max-w-3xl mx-auto">
        {/* Dev marker for UI identification */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mb-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-emerald-400 border border-emerald-800 bg-emerald-950/50 rounded px-2 py-1">
            <CheckCircle className="w-3 h-3" />
            Strategy UI: V4 Builder (Editable)
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Strategy
            </h1>
            <p className="text-sm text-slate-500 mt-1">{companyName}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Status pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                strategy?.status === 'finalized'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}
            >
              {strategy?.status === 'finalized' ? (
                <Lock className="w-3 h-3" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
              {strategy?.status === 'finalized' ? 'Finalized' : 'Draft'}
            </span>
            {/* View Mode Toggle */}
            <div className="inline-flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('command')}
                className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-300 rounded-md"
                title="Command Center"
              >
                <Compass className="w-3 h-3" />
              </button>
              <button
                className="px-2.5 py-1 text-xs font-medium text-white bg-purple-600 rounded-md"
                title="AI Builder (current)"
              >
                <Sparkles className="w-3 h-3" />
              </button>
              <button
                onClick={() => setViewMode('workspace')}
                className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-300 rounded-md"
                title="Artifacts"
              >
                <Layers className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* AI Strategy Assistant Panel */}
        <div className="bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-800/50 rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-base font-medium text-white">AI Strategy Assistant</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Improve your strategy using your latest inputs — nothing is overwritten without review.
                </p>
              </div>
            </div>
            {strategy?.updatedAt && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last updated: {new Date(strategy.updatedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Available Inputs */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-slate-500">AI will use:</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
              availableInputs.context
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}>
              {availableInputs.context ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              Context
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
              availableInputs.competition
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}>
              {availableInputs.competition ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              Competition
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
              availableInputs.websiteLab
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
            }`}>
              {availableInputs.websiteLab ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              Website Lab
            </span>
          </div>

          {/* Primary CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAIImproveStrategy}
              disabled={aiProposalLoading || !!proposal}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg disabled:opacity-50 disabled:cursor-wait transition-colors"
            >
              {aiProposalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {aiProposalLoading ? 'Generating...' : 'Improve Strategy'}
            </button>
            {proposal && (
              <button
                onClick={() => setShowProposalPreview(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4" />
                Preview changes
              </button>
            )}
          </div>

          {/* Helper text */}
          <p className="text-[11px] text-slate-500 mt-3">
            AI proposes updates as a draft. You can accept, edit, or discard.
          </p>
        </div>

        {/* Proposal Preview Section */}
        {proposal && showProposalPreview && (
          <div className="bg-slate-900 border border-purple-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-white flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-purple-400" />
                Proposed Changes
              </h2>
              <span className="text-[10px] text-slate-500">
                Generated {new Date(proposal.generatedAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Summary Diff */}
            {proposal.proposedSummary && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Summary</h3>
                <DiffPreview
                  original={strategy?.summary || '(No current summary)'}
                  suggested={proposal.proposedSummary}
                  maxHeight="200px"
                />
              </div>
            )}

            {/* Pillars Diff */}
            {proposal.proposedPillars && proposal.proposedPillars.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Top Priorities</h3>
                <DiffPreview
                  original={topPriorities.map(p => `• ${p.title}`).join('\n') || '(No current priorities)'}
                  suggested={proposal.proposedPillars.map(p => `• ${p.title}`).join('\n')}
                  maxHeight="150px"
                />
              </div>
            )}

            {/* Apply/Discard buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={handleApplyProposal}
                disabled={savingField === 'summary'}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50 transition-colors"
              >
                {savingField === 'summary' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Apply Changes
              </button>
              <button
                onClick={handleDiscardProposal}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Inputs Banner (compact) with deep links */}
        {strategyReadiness.completenessPercent < 100 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`text-sm font-medium ${
                strategyReadiness.completenessPercent >= 70
                  ? 'text-emerald-400'
                  : strategyReadiness.completenessPercent >= 40
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}>
                Inputs {strategyReadiness.completenessPercent}% complete
              </div>
              {missingInputsWithLinks.length > 0 && (
                <span className="text-xs text-slate-500">
                  Missing:{' '}
                  {missingInputsWithLinks.map((input, idx) => (
                    <span key={input.label}>
                      <a
                        href={input.href}
                        className="text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        {input.label}
                      </a>
                      {idx < missingInputsWithLinks.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </span>
              )}
            </div>
            <a
              href={`/c/${companyId}/context`}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Fix Inputs →
            </a>
          </div>
        )}

        {/* Strategy Snapshot */}
        {strategy?.id ? (
          <div id="strategy-frame" className="bg-slate-900 border border-slate-800 rounded-xl p-5 scroll-mt-20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-medium text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                Current Strategy
                {savedField === 'summary' && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Saved
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {/* Finalize Button */}
                <div className="relative group">
                  <button
                    onClick={() => setShowFinalizeConfirm(true)}
                    disabled={!canFinalize || strategy.status === 'finalized'}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      strategy.status === 'finalized'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
                        : canFinalize
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {strategy.status === 'finalized' ? (
                      <>
                        <Lock className="w-3 h-3" />
                        Finalized
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Finalize
                      </>
                    )}
                  </button>
                  {/* Disabled tooltip */}
                  {!canFinalize && strategy.status !== 'finalized' && finalizeDisabledReason && (
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-10">
                      <div className="bg-slate-800 border border-slate-700 text-xs text-slate-300 px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
                        {finalizeDisabledReason}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Title - Inline Editable */}
            <div className="mb-3">
              {isEditingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-lg font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                    placeholder="Strategy title..."
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveTitle}
                      disabled={savingField === 'title'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      {savingField === 'title' ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingTitle(false);
                        setEditedTitle(strategy.title || '');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (strategy.status !== 'finalized') {
                      setEditedTitle(strategy.title || '');
                      setIsEditingTitle(true);
                    }
                  }}
                  className={`flex items-center gap-2 ${
                    strategy.status !== 'finalized' ? 'cursor-pointer hover:bg-slate-800/50 rounded-lg px-2 py-1 -mx-2 -my-1 group' : ''
                  }`}
                  title={strategy.status !== 'finalized' ? 'Click to edit title' : undefined}
                >
                  <span className="text-lg font-semibold text-white">
                    {strategy.title || (
                      <span className="text-slate-500 italic font-normal">Untitled Strategy</span>
                    )}
                  </span>
                  {strategy.status !== 'finalized' && (
                    <Edit3 className="w-3.5 h-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                  {savedField === 'title' && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Saved
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Summary - Inline Editable */}
            <div className="mb-4">
              {isEditingSummary ? (
                <div className="space-y-2">
                  <textarea
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-none"
                    rows={4}
                    placeholder="Enter strategy summary..."
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveSummary}
                      disabled={savingField === 'summary'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      {savingField === 'summary' ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingSummary(false);
                        setEditedSummary(strategy.summary || '');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (strategy.status !== 'finalized') {
                      setEditedSummary(strategy.summary || '');
                      setIsEditingSummary(true);
                    }
                  }}
                  className={`text-sm text-slate-300 leading-relaxed ${
                    strategy.status !== 'finalized' ? 'cursor-pointer hover:bg-slate-800/50 rounded-lg px-2 py-1 -mx-2 -my-1' : ''
                  }`}
                  title={strategy.status !== 'finalized' ? 'Click to edit' : undefined}
                >
                  {strategy.summary || (
                    <span className="text-slate-500 italic">No summary yet. Click to add one.</span>
                  )}
                </div>
              )}
            </div>

            {/* Top Priorities - Inline Editable */}
            <div id="priorities" className="space-y-2 mb-4 scroll-mt-20">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Top Priorities
                </h3>
                {savedField === 'priorities' && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Saved
                  </span>
                )}
              </div>
              {isEditingPriorities ? (
                <div className="space-y-2">
                  {editedPriorities.map((priority, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 text-amber-400 rounded text-xs font-medium flex-shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={priority}
                        onChange={(e) => {
                          const updated = [...editedPriorities];
                          updated[idx] = e.target.value;
                          setEditedPriorities(updated);
                        }}
                        className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleSavePriorities}
                      disabled={savingField === 'priorities'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                    >
                      {savingField === 'priorities' ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Save
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingPriorities(false);
                        setEditedPriorities(topPriorities.map(p => p.title));
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : topPriorities.length > 0 ? (
                <div
                  onClick={() => {
                    if (strategy.status !== 'finalized') {
                      setEditedPriorities(topPriorities.map(p => p.title));
                      setIsEditingPriorities(true);
                    }
                  }}
                  className={`space-y-2 ${
                    strategy.status !== 'finalized' ? 'cursor-pointer hover:bg-slate-800/50 rounded-lg px-2 py-1 -mx-2 -my-1' : ''
                  }`}
                  title={strategy.status !== 'finalized' ? 'Click to edit' : undefined}
                >
                  {topPriorities.map((priority, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
                        {idx + 1}
                      </span>
                      <span className="text-slate-300">{priority.title}</span>
                      {priority.services.length > 0 && (
                        <span className="text-xs text-slate-500">
                          ({priority.services.join(', ')})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">
                  No priorities defined yet.
                </p>
              )}
            </div>

            {/* Next Best Action */}
            {strategy.objectives?.[0] && (
              <div className="bg-slate-800/50 rounded-lg px-3 py-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-slate-400">Next:</span>
                <span className="text-sm text-slate-300">{getObjectiveText(strategy.objectives[0])}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h2 className="text-base font-medium text-slate-400 mb-2">No Strategy Yet</h2>
            <p className="text-sm text-slate-500 mb-4">
              Use AI Propose above to generate your first strategy
            </p>
          </div>
        )}

        {/* Strategic Frame Editor */}
        {strategy?.id && (
          <StrategicFrameEditor
            frame={strategy.strategyFrame}
            onUpdate={handleUpdateFrame}
            onAiFill={handleAiFillFrame}
            companyId={companyId}
            isFinalized={strategy.status === 'finalized'}
          />
        )}

        {/* Strategy Blueprint (V5) - Objectives, Pillars, Plays */}
        {strategy?.id && (
          <div id="objectives" className="scroll-mt-20">
          <StrategyBlueprint
            companyId={companyId}
            strategy={strategy}
            strategyInputs={strategyInputs}
            onUpdateStrategy={handleUpdateStrategy}
            onGenerateWork={handleGenerateWork}
            isFinalized={strategy.status === 'finalized'}
          />
          </div>
        )}

        {/* Tactics Section Anchor */}
        <div id="tactics" className="scroll-mt-20" />

        {/* Finalize Confirmation Dialog */}
        {showFinalizeConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 flex items-center justify-center bg-emerald-500/10 rounded-lg flex-shrink-0">
                  <Lock className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Finalize Strategy?
                  </h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Once finalized, this strategy will be locked and cannot be edited.
                    You can still generate new strategy proposals with AI.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleFinalize}
                      disabled={finalizing}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {finalizing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Finalizing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Yes, Finalize
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowFinalizeConfirm(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Section (collapsed) */}
        <div className="border border-slate-800 rounded-lg">
          <button
            onClick={() => setAdvancedExpanded(!advancedExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-400 hover:text-slate-300"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Advanced Options
              <span className="text-xs text-slate-500">
                ({artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''})
              </span>
            </span>
            {advancedExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {advancedExpanded && (
            <div className="border-t border-slate-800 p-4 space-y-3">
              {/* Artifacts list */}
              {artifacts.length > 0 ? (
                <div className="space-y-2">
                  {artifacts.slice(0, 5).map(artifact => (
                    <div
                      key={artifact.id}
                      className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-300">{artifact.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ARTIFACT_STATUS_COLORS[artifact.status]}`}>
                          {ARTIFACT_STATUS_LABELS[artifact.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                  {artifacts.length > 5 && (
                    <p className="text-xs text-slate-500 text-center">
                      +{artifacts.length - 5} more artifacts
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-2">
                  No artifacts yet
                </p>
              )}

              {/* Link to advanced workspace (opt-in) */}
              <Link
                href={`/c/${companyId}/strategy?mode=advanced`}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-400 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/50 rounded-lg transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                Open Advanced Workspace (Legacy)
              </Link>
            </div>
          )}
        </div>

      </div>
      </GuidanceContext.Provider>
    );
  }

  // ============================================================================
  // WORKSPACE VIEW (3-column layout) - Artifacts & Deep Work
  // Access only via ?mode=advanced or view mode toggle
  // ============================================================================
  return (
    <GuidanceContext.Provider value={guidance}>
    <div className="space-y-4">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" />
          Artifacts & Deep Work
        </h1>
        <div className="inline-flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode('command')}
            className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-300 rounded-md"
            title="Command Center"
          >
            <Compass className="w-3 h-3" />
          </button>
          <button
            onClick={() => setViewMode('builder')}
            className="px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-300 rounded-md"
            title="AI Builder"
          >
            <Sparkles className="w-3 h-3" />
          </button>
          <button
            className="px-2.5 py-1 text-xs font-medium text-white bg-amber-600 rounded-md"
            title="Artifacts (current)"
          >
            <Layers className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-slate-300 font-medium">Artifacts & Deep Work</p>
              <p className="text-slate-400 text-sm">
                Create and manage strategy artifacts, explore growth options, and document assumptions.
              </p>
            </div>
          </div>
          <Link
            href={`/c/${companyId}/strategy`}
            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Back to Builder
          </Link>
        </div>
        <p className="text-amber-200/40 text-xs mt-2">
          Changes here may not be supported long-term.
        </p>
      </div>

      {/* Dev marker for UI identification */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="mb-2 inline-flex text-[10px] uppercase tracking-wide text-amber-400 border border-amber-800 bg-amber-950/50 rounded px-2 py-1">
          Strategy UI: V4 Workspace (Advanced - Deprecated)
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Advanced Strategy Workspace
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Build and promote strategy artifacts for {companyName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Back to Builder - navigates to canonical URL */}
          <Link
            href={`/c/${companyId}/strategy`}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            Back to Builder
          </Link>
          {/* Guidance Toggle */}
          <button
            onClick={guidance.toggleGuidance}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            title="Show or hide guidance on how to build a strategy"
          >
            {guidance.showGuidance ? (
              <ToggleRight className="w-4 h-4 text-cyan-400" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            <span className={guidance.showGuidance ? 'text-cyan-400' : ''}>
              Guidance
            </span>
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3-Column Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column: Strategy Inputs */}
        <div className="col-span-3 space-y-3">
          {/* Header */}
          <div className="px-1">
            <h2 className="text-sm font-medium text-slate-300">Strategy Inputs</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">
              These define the reality and constraints this strategy must operate within.
            </p>
          </div>

          {/* Staleness Guard */}
          <StrategyInputsMeta
            lastUpdatedAt={strategyInputs.meta.lastUpdatedAt}
            contextRevisionId={strategyInputs.meta.contextRevisionId}
            completenessScore={strategyInputs.meta.completenessScore}
          />

          {/* 1. Business Reality */}
          <StrategyInputSection
            title="Business Reality"
            icon={<FileText className="w-4 h-4" />}
            onViewDetails={() => setDetailsDrawerSection('businessReality')}
            fixInContextLink={getContextDeepLink(companyId, 'businessReality')}
            onImproveWithAI={() => handleAIImprove('businessReality')}
            isImproving={aiImprovingSection === 'businessReality'}
          >
            <InputField label="Stage" value={strategyInputs.businessReality.stage} />
            <InputField label="Business Model" value={strategyInputs.businessReality.businessModel} />
            <InputField label="Primary Offering" value={strategyInputs.businessReality.primaryOffering} />
            <InputField label="Primary Audience" value={strategyInputs.businessReality.primaryAudience || strategyInputs.businessReality.icpDescription} />
            <InputField label="Goals" value={strategyInputs.businessReality.goals.join(', ') || null} />
          </StrategyInputSection>

          {/* 2. Constraints */}
          <StrategyInputSection
            title="Constraints"
            icon={<AlertTriangle className="w-4 h-4" />}
            onViewDetails={() => setDetailsDrawerSection('constraints')}
            fixInContextLink={getContextDeepLink(companyId, 'constraints')}
            onImproveWithAI={() => handleAIImprove('constraints')}
            isImproving={aiImprovingSection === 'constraints'}
          >
            <InputField
              label="Budget Range"
              value={
                strategyInputs.constraints.minBudget || strategyInputs.constraints.maxBudget
                  ? `${strategyInputs.constraints.minBudget ? `$${strategyInputs.constraints.minBudget.toLocaleString()}` : '—'} – ${strategyInputs.constraints.maxBudget ? `$${strategyInputs.constraints.maxBudget.toLocaleString()}` : '—'}`
                  : null
              }
            />
            <InputField
              label="Launch Deadlines"
              value={strategyInputs.constraints.launchDeadlines.length > 0 ? strategyInputs.constraints.launchDeadlines.join(', ') : null}
            />
            <InputField
              label="Channel Restrictions"
              value={strategyInputs.constraints.channelRestrictions.length > 0 ? `${strategyInputs.constraints.channelRestrictions.length} restriction(s)` : null}
            />
            <InputField
              label="Compliance"
              value={strategyInputs.constraints.complianceRequirements.length > 0 ? strategyInputs.constraints.complianceRequirements.join(', ') : null}
            />
          </StrategyInputSection>

          {/* 3. Competitive Landscape */}
          <StrategyInputSection
            title="Competitive Landscape"
            icon={<Users className="w-4 h-4" />}
            badge={strategyInputs.competition.sourceVersion !== 'none' ? (
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                strategyInputs.competition.sourceVersion === 'v4'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {strategyInputs.competition.sourceVersion.toUpperCase()}
              </span>
            ) : undefined}
            onViewDetails={() => setDetailsDrawerSection('competition')}
            fixInContextLink={getContextDeepLink(companyId, 'competition')}
            onImproveWithAI={() => handleAIImprove('competition')}
            isImproving={aiImprovingSection === 'competition'}
          >
            <InputField
              label="Competitors"
              value={strategyInputs.competition.competitors.length > 0
                ? strategyInputs.competition.competitors.map(c => c.name).slice(0, 5).join(', ') + (strategyInputs.competition.competitors.length > 5 ? ` +${strategyInputs.competition.competitors.length - 5} more` : '')
                : null}
            />
            <InputField
              label="Positioning Axes"
              value={strategyInputs.competition.positioningAxisPrimary && strategyInputs.competition.positioningAxisSecondary
                ? `${strategyInputs.competition.positioningAxisPrimary} × ${strategyInputs.competition.positioningAxisSecondary}`
                : strategyInputs.competition.positioningAxisPrimary}
            />
            <InputField label="Position Summary" value={strategyInputs.competition.positionSummary} />
          </StrategyInputSection>

          {/* 4. Execution Capabilities (Hive) */}
          <StrategyInputSection
            title="Execution Capabilities"
            icon={<Brain className="w-4 h-4" />}
            subtitle="Hive"
            onViewDetails={() => setDetailsDrawerSection('executionCapabilities')}
            fixInContextLink={getHiveBrainLink()}
            onImproveWithAI={() => handleAIImprove('executionCapabilities')}
            isImproving={aiImprovingSection === 'executionCapabilities'}
          >
            <InputField
              label="Services"
              value={strategyInputs.executionCapabilities.serviceTaxonomy.length > 0
                ? strategyInputs.executionCapabilities.serviceTaxonomy.slice(0, 5).join(', ') + (strategyInputs.executionCapabilities.serviceTaxonomy.length > 5 ? ` +${strategyInputs.executionCapabilities.serviceTaxonomy.length - 5} more` : '')
                : null}
            />
            <InputField
              label="Doctrine"
              value={`v${strategyInputs.executionCapabilities.doctrineVersion}`}
            />
          </StrategyInputSection>
        </div>

        {/* Center Column: Working Area (Artifacts) */}
        <div className="col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-400 px-1">
              Strategy Artifacts ({artifacts.length})
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300"
            >
              <Plus className="w-4 h-4" />
              Custom Artifact
            </button>
          </div>

          {/* Empty State Guidance Card */}
          {artifacts.length === 0 && <EmptyWorkspaceGuidance />}

          {/* Strategy Readiness Banner */}
          <StrategyReadinessBanner readiness={strategyReadiness} companyId={companyId} />

          {/* Guided Artifact Starters - Always visible */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 px-1">Start with a template (AI prefilled):</p>
            <div className="grid grid-cols-2 gap-2">
              {ARTIFACT_STARTERS.map(starter => (
                <StarterButton
                  key={starter.type}
                  starter={starter}
                  onClick={() => handleStarterCreate(starter)}
                  disabled={loading || !!prefillLoadingId}
                  isGenerating={!!prefillLoadingId}
                />
              ))}
            </div>
            {/* Prefill Error */}
            {prefillError && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400">
                  AI prefill failed: {prefillError}. Using template instead.
                </p>
              </div>
            )}
          </div>

          {/* AI Tools Toolbar */}
          <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-medium text-slate-200">AI Tools</h3>
              <span className="text-xs text-slate-500 ml-auto">Creates artifacts only</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Option Generator */}
              <button
                onClick={handleAIGenerateOptions}
                disabled={!!aiToolLoading}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
              >
                {aiToolLoading === 'options' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                Generate Options
              </button>

              {/* Assumption Mapper */}
              <button
                onClick={handleAIMapAssumptions}
                disabled={!!aiToolLoading || selectedArtifactIds.size === 0}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
                title={selectedArtifactIds.size === 0 ? 'Select artifacts first' : undefined}
              >
                {aiToolLoading === 'assumptions' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                Map Assumptions
                {selectedArtifactIds.size > 0 && (
                  <span className="px-1.5 py-0.5 text-xs bg-cyan-500/20 rounded">
                    {selectedArtifactIds.size}
                  </span>
                )}
              </button>

              {/* Synthesize (with soft gating) */}
              <div className="relative group">
                <button
                  onClick={handleAISynthesize}
                  disabled={!!aiToolLoading || selectedArtifactIds.size < 2 || !strategyReadiness.canSynthesize}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    !strategyReadiness.canSynthesize
                      ? 'text-slate-500 bg-slate-800/50 border border-slate-700 cursor-not-allowed'
                      : 'text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-50'
                  }`}
                  title={
                    !strategyReadiness.canSynthesize
                      ? strategyReadiness.synthesizeBlockReason || 'Missing critical inputs'
                      : selectedArtifactIds.size < 2
                      ? 'Select at least 2 artifacts'
                      : undefined
                  }
                >
                  {aiToolLoading === 'synthesize' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GitMerge className="w-3.5 h-3.5" />
                  )}
                  Synthesize
                  {selectedArtifactIds.size >= 2 && strategyReadiness.canSynthesize && (
                    <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 rounded">
                      {selectedArtifactIds.size}
                    </span>
                  )}
                </button>
                {/* Tooltip for soft gate */}
                {!strategyReadiness.canSynthesize && (
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <p className="text-xs text-amber-400 mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Critical inputs missing
                    </p>
                    <p className="text-xs text-slate-400">
                      {strategyReadiness.synthesizeBlockReason}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {selectedArtifactIds.size === 0
                ? 'Select artifacts below to use Map Assumptions or Synthesize'
                : `${selectedArtifactIds.size} artifact${selectedArtifactIds.size > 1 ? 's' : ''} selected`}
            </p>
          </div>

          {/* Artifacts List */}
          {artifacts.length === 0 ? (
            <div className="bg-slate-900/30 border border-slate-800/50 border-dashed rounded-xl p-6 text-center">
              <BookOpen className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No artifacts yet</p>
              <p className="text-xs text-slate-600 mt-1">Choose a template above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {artifacts.map(artifact => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  isSelected={selectedArtifactIds.has(artifact.id)}
                  isIncludedInStrategy={includedArtifactIds.has(artifact.id)}
                  onToggleSelect={() => toggleArtifactSelection(artifact.id)}
                  onEdit={() => setEditingArtifact(artifact)}
                  onDelete={() => handleDeleteArtifact(artifact.id)}
                  onStatusChange={(status) => handleUpdateArtifact(artifact.id, { status })}
                />
              ))}
            </div>
          )}

          {/* Promote Button */}
          {promotableArtifacts.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handlePromote}
                disabled={selectedArtifactIds.size === 0 || loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Promote to Canonical ({selectedArtifactIds.size} selected)
              </button>
              <p className="text-xs text-slate-500 text-center mt-2">
                Select artifacts to include in canonical strategy
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Canonical Strategy */}
        <div className="col-span-4 space-y-4">
          <h2 className="text-sm font-medium text-slate-400 px-1">Canonical Strategy</h2>

          {strategy ? (
            <CanonicalStrategyCard
              strategy={strategy}
              artifactCountsByType={artifactCountsByType}
              inputsUsed={inputsUsed}
            />
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-8 text-center">
              <Target className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-2">No canonical strategy yet</p>
              <p className="text-xs text-slate-600">
                Promote artifacts to create the canonical strategy
              </p>
            </div>
          )}

          {/* Promoted Artifacts History */}
          {promotedArtifacts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-500 px-1 flex items-center gap-1">
                <Archive className="w-3 h-3" />
                Promotion History
              </h3>
              {promotedArtifacts.map(artifact => (
                <div
                  key={artifact.id}
                  className="p-3 bg-slate-900/30 border border-slate-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-slate-400 truncate flex-1">
                      {artifact.title}
                    </span>
                    {artifact.promotedAt && (
                      <span className="text-xs text-slate-600">
                        {new Date(artifact.promotedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Artifact Modal */}
      {showCreateModal && (
        <CreateArtifactModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateArtifact}
          loading={loading}
        />
      )}

      {/* Edit Artifact Modal */}
      {editingArtifact && (
        <EditArtifactModal
          artifact={editingArtifact}
          companyId={companyId}
          onClose={() => setEditingArtifact(null)}
          onSave={(updates) => handleUpdateArtifact(editingArtifact.id, updates)}
          loading={loading}
        />
      )}

      {/* Strategy Input Details Drawer */}
      {detailsDrawerSection && (
        <StrategyInputDetailsDrawer
          section={detailsDrawerSection}
          strategyInputs={strategyInputs}
          companyId={companyId}
          onClose={() => setDetailsDrawerSection(null)}
        />
      )}
    </div>
    </GuidanceContext.Provider>
  );
}

// ============================================================================
// Empty Workspace Guidance Card
// ============================================================================

function EmptyWorkspaceGuidance() {
  const { showGuidance } = useGuidance();

  if (!showGuidance) return null;

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <Compass className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-200">How to Build Your Strategy</h3>
          <p className="text-xs text-slate-500 mt-0.5">Follow this workflow to develop a well-considered strategy</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[10px] font-medium text-amber-400">1</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Explore options</p>
            <p className="text-[10px] text-slate-500">Start with growth options or assumptions</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[10px] font-medium text-cyan-400">2</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Draft your strategy</p>
            <p className="text-[10px] text-slate-500">Synthesize into strategic direction</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[10px] font-medium text-emerald-400">3</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Review &amp; promote</p>
            <p className="text-[10px] text-slate-500">Mark best as candidates, promote to canonical</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[10px] font-medium text-purple-400">4</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Iterate &amp; refine</p>
            <p className="text-[10px] text-slate-500">Continue refining workspace artifacts</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Strategy Readiness Banner
// ============================================================================

function StrategyReadinessBanner({
  readiness,
  companyId,
}: {
  readiness: StrategyReadiness;
  companyId: string;
}) {
  // Don't show if fully ready
  if (readiness.isReady) return null;

  return (
    <div className={`rounded-xl p-4 ${
      readiness.missingCritical.length >= 2
        ? 'bg-amber-500/10 border border-amber-500/30'
        : 'bg-slate-800/50 border border-slate-700'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          readiness.missingCritical.length >= 2
            ? 'bg-amber-500/20'
            : 'bg-slate-700/50'
        }`}>
          <AlertTriangle className={`w-4 h-4 ${
            readiness.missingCritical.length >= 2
              ? 'text-amber-400'
              : 'text-slate-400'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-sm font-medium ${
              readiness.missingCritical.length >= 2
                ? 'text-amber-300'
                : 'text-slate-300'
            }`}>
              Strategy Inputs Incomplete
            </h4>
            <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
              readiness.completenessPercent >= 75
                ? 'bg-emerald-500/20 text-emerald-400'
                : readiness.completenessPercent >= 50
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {readiness.completenessPercent}% complete
            </span>
          </div>
          <ul className="space-y-1.5 mt-2">
            {readiness.warnings.map((warning, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs">
                <span className="text-slate-500 mt-0.5">•</span>
                <span className="text-slate-400 flex-1">{warning.message}</span>
                <a
                  href={
                    warning.section === 'executionCapabilities'
                      ? getHiveBrainLink()
                      : getContextDeepLink(companyId, warning.section)
                  }
                  className="text-cyan-400 hover:text-cyan-300 whitespace-nowrap flex items-center gap-1"
                >
                  <span>{warning.fixHint}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            ))}
          </ul>
          {!readiness.canSynthesize && (
            <div className="mt-3 pt-2 border-t border-amber-500/20">
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" />
                Synthesize Strategy disabled until critical inputs are added
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Starter Button with Hints
// ============================================================================

function StarterButton({
  starter,
  onClick,
  disabled,
  isGenerating,
}: {
  starter: {
    type: StrategyArtifactType;
    label: string;
    description: string;
    icon: React.ReactNode;
  };
  onClick: () => void;
  disabled: boolean;
  isGenerating?: boolean;
}) {
  const { showGuidance } = useGuidance();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-lg hover:border-slate-700 hover:bg-slate-900/70 transition-colors text-left disabled:opacity-50"
    >
      <span className="text-amber-400 mt-0.5">
        {isGenerating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          starter.icon
        )}
      </span>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-slate-200 flex items-center gap-2">
          {starter.label}
          <Sparkles className="w-3 h-3 text-purple-400" />
        </h4>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{starter.description}</p>
        {/* Type hint (guidance) */}
        {showGuidance && ARTIFACT_TYPE_HINTS[starter.type] && (
          <p className="text-[10px] text-cyan-400/70 mt-1 italic line-clamp-2">
            {ARTIFACT_TYPE_HINTS[starter.type]}
          </p>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Strategy Inputs Meta Component (Staleness Guard)
// ============================================================================

function StrategyInputsMeta({
  lastUpdatedAt,
  contextRevisionId,
  completenessScore,
}: {
  lastUpdatedAt: string | null;
  contextRevisionId: string | null;
  completenessScore: number | null;
}) {
  // Format relative time
  const getRelativeTime = (date: string | null) => {
    if (!date) return null;
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  const relativeTime = getRelativeTime(lastUpdatedAt);

  return (
    <div className="px-1 py-2 flex items-center gap-3 text-[10px] text-slate-500">
      {relativeTime && (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Updated {relativeTime}
        </span>
      )}
      {contextRevisionId && (
        <span className="font-mono text-slate-600" title={contextRevisionId}>
          Rev: {contextRevisionId.slice(0, 8)}
        </span>
      )}
      {completenessScore !== null && (
        <span className={completenessScore >= 70 ? 'text-emerald-500' : completenessScore >= 40 ? 'text-amber-500' : 'text-red-500'}>
          {completenessScore}% complete
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Strategy Input Section Component
// ============================================================================

function StrategyInputSection({
  title,
  icon,
  subtitle,
  badge,
  children,
  onViewDetails,
  fixInContextLink,
  onImproveWithAI,
  isImproving,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  onViewDetails?: () => void;
  fixInContextLink?: string;
  onImproveWithAI?: () => void;
  isImproving?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-slate-800/30 transition-colors text-left"
      >
        <span className="text-slate-400">{icon}</span>
        <span className="text-xs font-medium text-slate-200 flex-1">
          {title}
          {subtitle && <span className="text-slate-500 font-normal ml-1">({subtitle})</span>}
        </span>
        {badge}
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {children}
          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/50">
            {onViewDetails && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails();
                }}
                className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-300"
              >
                <Info className="w-3 h-3" />
                View details
              </button>
            )}
            {fixInContextLink && (
              <a
                href={fixInContextLink}
                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
                Update Facts
              </a>
            )}
            {onImproveWithAI && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onImproveWithAI();
                }}
                disabled={isImproving}
                className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 disabled:opacity-50 ml-auto"
              >
                {isImproving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Improve with AI
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Input Field Component
// ============================================================================

function InputField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-slate-500 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-[11px] flex-1 ${value ? 'text-slate-300' : 'text-slate-600 italic'}`}>
        {value || 'Not set'}
      </span>
    </div>
  );
}

// ============================================================================
// Artifact Card Component
// ============================================================================

function ArtifactCard({
  artifact,
  isSelected,
  isIncludedInStrategy,
  onToggleSelect,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  artifact: StrategyArtifact;
  isSelected: boolean;
  isIncludedInStrategy?: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: StrategyArtifactStatus) => void;
}) {
  const isEditable = canEditArtifact(artifact);
  const isPromotable = canPromoteArtifact(artifact);

  return (
    <div
      className={`bg-slate-900/50 border rounded-xl p-4 transition-colors ${
        isSelected
          ? 'border-amber-500/50 bg-amber-500/5'
          : isIncludedInStrategy
          ? 'border-emerald-500/30'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Selection checkbox */}
        {isPromotable && (
          <button
            onClick={onToggleSelect}
            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-slate-600 hover:border-slate-500'
            }`}
          >
            {isSelected && <CheckCircle className="w-3 h-3" />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${ARTIFACT_STATUS_COLORS[artifact.status]}`}>
              {ARTIFACT_STATUS_LABELS[artifact.status]}
            </span>
            <span className="text-xs text-slate-500">
              {ARTIFACT_TYPE_LABELS[artifact.type]}
            </span>
            {/* AI-generated badge */}
            {artifact.source === 'ai_tool' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
            {/* Usage badge */}
            {isIncludedInStrategy ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded ml-auto">
                <Link2 className="w-3 h-3" />
                In strategy
              </span>
            ) : artifact.status !== 'promoted' && artifact.status !== 'discarded' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-slate-500 bg-slate-800/50 rounded ml-auto">
                <Unlink className="w-3 h-3" />
                Not yet used
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-slate-200 truncate">
            {artifact.title}
          </h3>

          {/* Content preview */}
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {artifact.content.slice(0, 150)}
            {artifact.content.length > 150 && '...'}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(artifact.updatedAt).toLocaleDateString()}
            </span>

            {isEditable && (
              <div className="flex items-center gap-1 ml-auto">
                {/* Status change dropdown */}
                <select
                  value={artifact.status}
                  onChange={(e) => onStatusChange(e.target.value as StrategyArtifactStatus)}
                  className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-400 focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="explored">Explored</option>
                  <option value="candidate">Candidate</option>
                  <option value="discarded">Discarded</option>
                </select>

                <button
                  onClick={onEdit}
                  className="p-1.5 text-slate-500 hover:text-cyan-400"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 text-slate-500 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Canonical Strategy Card
// ============================================================================

function CanonicalStrategyCard({
  strategy,
  artifactCountsByType,
  inputsUsed,
}: {
  strategy: CompanyStrategy;
  artifactCountsByType: Record<string, number>;
  inputsUsed: { context: boolean; competition: boolean; hiveBrain: boolean };
}) {
  const hasArtifacts = strategy.sourceArtifactIds && strategy.sourceArtifactIds.length > 0;
  const isSeedStrategy = !hasArtifacts && !strategy.promotedFromArtifacts;

  return (
    <div className="bg-slate-900/50 border border-emerald-500/30 rounded-xl overflow-hidden">
      {/* Provenance Metadata Strip */}
      <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-slate-400">Sources:</span>
          {inputsUsed.context && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-cyan-400 bg-cyan-500/10 rounded">
              <FileText className="w-3 h-3" />
              Context
            </span>
          )}
          {inputsUsed.competition && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-purple-400 bg-purple-500/10 rounded">
              <Users className="w-3 h-3" />
              Competition
            </span>
          )}
          {inputsUsed.hiveBrain && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-amber-400 bg-amber-500/10 rounded">
              <Brain className="w-3 h-3" />
              Hive Brain
            </span>
          )}
          {!inputsUsed.context && !inputsUsed.competition && !inputsUsed.hiveBrain && (
            <span className="text-xs text-slate-500">No inputs linked</span>
          )}
        </div>

        {/* Artifact counts by type */}
        {hasArtifacts && Object.keys(artifactCountsByType).length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-slate-500">From artifacts:</span>
            {Object.entries(artifactCountsByType).map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-400 bg-slate-700/50 rounded"
              >
                {count} {ARTIFACT_TYPE_LABELS[type as StrategyArtifactType] || type}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Seed Strategy Warning */}
      {isSeedStrategy && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <p className="text-xs text-amber-400">
            Seed strategy. Create artifacts to refine it.
          </p>
        </div>
      )}

      {/* Main Content */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            strategy.status === 'finalized'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
          }`}>
            {strategy.status === 'finalized' ? 'Finalized' : 'Draft'}
          </span>
        </div>

        <h3 className="text-base font-medium text-white mb-2">
          {strategy.title || 'Untitled Strategy'}
        </h3>

        {strategy.summary && (
          <p className="text-sm text-slate-400 mb-4">
            {strategy.summary}
          </p>
        )}

        {/* Pillars */}
        {strategy.pillars && strategy.pillars.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-slate-500">Pillars</h4>
            {strategy.pillars.map((pillar, idx) => (
              <div key={pillar.id || idx} className="flex items-center gap-2 text-xs">
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="text-slate-300">{pillar.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Version metadata (collapsed) */}
        {strategy.baseContextRevisionId && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <div className="text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <Info className="w-3 h-3" />
                <code className="px-1 py-0.5 bg-slate-800 rounded text-slate-500">
                  rev:{strategy.baseContextRevisionId.slice(0, 8)}
                </code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Create Artifact Modal
// ============================================================================

function CreateArtifactModal({
  onClose,
  onCreate,
  loading,
}: {
  onClose: () => void;
  onCreate: (data: ArtifactFormData) => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState<ArtifactFormData>({
    type: 'draft_strategy',
    title: '',
    content: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          Create Artifact
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Artifact Type
            </label>
            <select
              value={formData.type}
              onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as StrategyArtifactType }))}
              className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              {Object.entries(ARTIFACT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Q1 Growth Strategy Draft"
              className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              autoFocus
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Content
            </label>
            <textarea
              value={formData.content}
              onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Strategy details, insights, notes..."
              rows={6}
              className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.title.trim() || loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Edit Artifact Modal (with AI Regenerate Tools)
// ============================================================================

// ============================================================================
// Strategy Input Details Drawer
// ============================================================================

type DetailsDrawerSection = 'businessReality' | 'constraints' | 'competition' | 'executionCapabilities';

const SECTION_TITLES: Record<DetailsDrawerSection, string> = {
  businessReality: 'Business Reality',
  constraints: 'Constraints',
  competition: 'Competitive Landscape',
  executionCapabilities: 'Execution Capabilities',
};

const SECTION_ICONS: Record<DetailsDrawerSection, React.ReactNode> = {
  businessReality: <FileText className="w-5 h-5" />,
  constraints: <AlertTriangle className="w-5 h-5" />,
  competition: <Users className="w-5 h-5" />,
  executionCapabilities: <Brain className="w-5 h-5" />,
};

interface FieldProvenance {
  label: string;
  value: string | null;
  fieldPath: string;
  domain: string;
}

function StrategyInputDetailsDrawer({
  section,
  strategyInputs,
  companyId,
  onClose,
}: {
  section: DetailsDrawerSection;
  strategyInputs: StrategyInputs;
  companyId: string;
  onClose: () => void;
}) {
  // Build fields based on section
  const fields: FieldProvenance[] = useMemo(() => {
    switch (section) {
      case 'businessReality':
        return [
          { label: 'Company Stage', value: strategyInputs.businessReality.stage, fieldPath: 'identity.stage', domain: 'identity' },
          { label: 'Business Model', value: strategyInputs.businessReality.businessModel, fieldPath: 'identity.businessModel', domain: 'identity' },
          { label: 'Primary Offering', value: strategyInputs.businessReality.primaryOffering, fieldPath: 'productOffer.primaryProduct', domain: 'productOffer' },
          { label: 'Primary Audience', value: strategyInputs.businessReality.primaryAudience || strategyInputs.businessReality.icpDescription, fieldPath: 'audience.primaryAudience', domain: 'audience' },
          { label: 'ICP Description', value: strategyInputs.businessReality.icpDescription, fieldPath: 'audience.icpDescription', domain: 'audience' },
          { label: 'Goals', value: strategyInputs.businessReality.goals.join(', ') || null, fieldPath: 'objectives.goals', domain: 'objectives' },
        ];
      case 'constraints':
        return [
          { label: 'Minimum Budget', value: strategyInputs.constraints.minBudget ? `$${strategyInputs.constraints.minBudget.toLocaleString()}` : null, fieldPath: 'operationalConstraints.budget.min', domain: 'operationalConstraints' },
          { label: 'Maximum Budget', value: strategyInputs.constraints.maxBudget ? `$${strategyInputs.constraints.maxBudget.toLocaleString()}` : null, fieldPath: 'operationalConstraints.budget.max', domain: 'operationalConstraints' },
          { label: 'Launch Deadlines', value: strategyInputs.constraints.launchDeadlines.length > 0 ? strategyInputs.constraints.launchDeadlines.join(', ') : null, fieldPath: 'operationalConstraints.timeline.deadlines', domain: 'operationalConstraints' },
          { label: 'Channel Restrictions', value: strategyInputs.constraints.channelRestrictions.length > 0 ? strategyInputs.constraints.channelRestrictions.map(r => r.channelId).join(', ') : null, fieldPath: 'operationalConstraints.channelRestrictions', domain: 'operationalConstraints' },
          { label: 'Compliance Requirements', value: strategyInputs.constraints.complianceRequirements.length > 0 ? strategyInputs.constraints.complianceRequirements.join(', ') : null, fieldPath: 'operationalConstraints.compliance', domain: 'operationalConstraints' },
        ];
      case 'competition':
        return [
          { label: 'Data Source', value: strategyInputs.competition.sourceVersion !== 'none' ? `Competition ${strategyInputs.competition.sourceVersion.toUpperCase()}` : null, fieldPath: 'competitive.source', domain: 'competitive' },
          { label: 'Run Date', value: strategyInputs.competition.sourceRunDate ? new Date(strategyInputs.competition.sourceRunDate).toLocaleDateString() : null, fieldPath: 'competitive.sourceRunDate', domain: 'competitive' },
          { label: 'Competitors', value: strategyInputs.competition.competitors.map(c => c.name).join(', ') || null, fieldPath: 'competitive.competitors', domain: 'competitive' },
          { label: 'Primary Positioning Axis', value: strategyInputs.competition.positioningAxisPrimary, fieldPath: 'competitive.positioningAxes.primary', domain: 'competitive' },
          { label: 'Secondary Positioning Axis', value: strategyInputs.competition.positioningAxisSecondary, fieldPath: 'competitive.positioningAxes.secondary', domain: 'competitive' },
          { label: 'Position Summary', value: strategyInputs.competition.positionSummary, fieldPath: 'competitive.positionSummary', domain: 'competitive' },
        ];
      case 'executionCapabilities':
        return [
          { label: 'Doctrine Version', value: `v${strategyInputs.executionCapabilities.doctrineVersion}`, fieldPath: 'hiveBrain.doctrine.version', domain: 'hiveBrain' },
          { label: 'Service Taxonomy', value: strategyInputs.executionCapabilities.serviceTaxonomy.join(', ') || null, fieldPath: 'hiveBrain.serviceTaxonomy', domain: 'hiveBrain' },
          { label: 'Operating Principles', value: strategyInputs.executionCapabilities.operatingPrinciples.join('; ') || null, fieldPath: 'hiveBrain.doctrine.principles', domain: 'hiveBrain' },
        ];
      default:
        return [];
    }
  }, [section, strategyInputs]);

  // Get edit link based on section
  const editLink = section === 'executionCapabilities'
    ? getHiveBrainLink()
    : getContextDeepLink(companyId, section);

  // Count missing values
  const missingCount = fields.filter(f => !f.value).length;
  const completenessPercent = Math.round(((fields.length - missingCount) / fields.length) * 100);

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <span className="text-slate-400">{SECTION_ICONS[section]}</span>
          <div className="flex-1">
            <h2 className="text-base font-medium text-white">{SECTION_TITLES[section]}</h2>
            <p className="text-xs text-slate-500">Field details and provenance</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meta Info + Completeness */}
        <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Section Completeness</span>
            <span className={`text-xs font-medium ${
              completenessPercent >= 80 ? 'text-emerald-400' :
              completenessPercent >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {completenessPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                completenessPercent >= 80 ? 'bg-emerald-500' :
                completenessPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${completenessPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            {strategyInputs.meta.contextRevisionId && (
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                <code className="px-1 py-0.5 bg-slate-800 rounded text-slate-600">
                  {strategyInputs.meta.contextRevisionId.slice(0, 12)}
                </code>
              </span>
            )}
            {strategyInputs.meta.lastUpdatedAt && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(strategyInputs.meta.lastUpdatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {fields.map((field, idx) => {
            const isEmpty = !field.value;
            return (
              <div
                key={idx}
                className={`border rounded-lg p-3 ${
                  isEmpty
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-slate-800/40 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    {field.label}
                    {isEmpty && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded">
                        Missing
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono">{field.domain}</span>
                </div>
                <div className={`text-sm ${field.value ? 'text-slate-200' : 'text-slate-600 italic'}`}>
                  {field.value || 'Not set'}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <code className="text-slate-600">{field.fieldPath}</code>
                  </div>
                  {isEmpty && (
                    <a
                      href={editLink}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      Fix
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-800/20 space-y-3">
          {missingCount > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-xs text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {missingCount} field{missingCount > 1 ? 's' : ''} missing. This may affect strategy quality.
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <a
              href={editLink}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Edit in {section === 'executionCapabilities' ? 'Hive Brain' : 'Context'}
            </a>
          </div>
          <p className="text-[10px] text-slate-600 text-center">
            Strategy page is read-only. Changes require review in the source workspace.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Copilot Types & Config
// ============================================================================

type CopilotIntent = 'flesh_out' | 'rewrite' | 'add_missing' | 'actionable' | 'tighten';
type ApplyMode = 'replace' | 'append' | 'insert';

const COPILOT_INTENTS: { id: CopilotIntent; label: string; description: string; icon: typeof Sparkles }[] = [
  { id: 'flesh_out', label: 'Flesh Out', description: 'Expand notes into fuller content', icon: TrendingUp },
  { id: 'rewrite', label: 'Rewrite', description: 'Better structure & clarity', icon: RefreshCw },
  { id: 'add_missing', label: 'Add Missing', description: 'Add expected sections', icon: PlusCircle },
  { id: 'actionable', label: 'Make Actionable', description: 'More specific & executable', icon: Target },
  { id: 'tighten', label: 'Tighten', description: 'Condense & remove fluff', icon: Layers },
];

// ============================================================================
// Edit Artifact Modal with Copilot
// ============================================================================

function EditArtifactModal({
  artifact,
  companyId,
  onClose,
  onSave,
  loading,
}: {
  artifact: StrategyArtifact;
  companyId: string;
  onClose: () => void;
  onSave: (updates: Partial<Pick<StrategyArtifact, 'title' | 'content'>>) => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: artifact.title,
    content: artifact.content,
  });

  // AI regeneration state (local only - doesn't auto-save)
  const [regenerating, setRegenerating] = useState<'replace' | 'alternative' | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  // Copilot state
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotIntent, setCopilotIntent] = useState<CopilotIntent>('flesh_out');
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [copilotSuggestion, setCopilotSuggestion] = useState<string | null>(null);
  const [copilotNotes, setCopilotNotes] = useState<string[]>([]);
  const [applyMode, setApplyMode] = useState<ApplyMode>('replace');

  // Track if content has been modified from original
  const isModified = formData.title !== artifact.title || formData.content !== artifact.content;
  const isAiGenerated = artifact.source === 'ai_tool';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSave(formData);
  };

  // Regenerate draft (replace mode)
  const handleRegenerate = async () => {
    setRegenerating('replace');
    setRegenerateError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/artifacts/${artifact.id}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'replace' }),
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to regenerate');
      }
      // Update LOCAL form state only (not saved yet)
      setFormData({
        title: data.title || formData.title,
        content: data.contentMarkdown,
      });
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : 'Regeneration failed');
    } finally {
      setRegenerating(null);
    }
  };

  // Suggest alternative (append mode)
  const handleSuggestAlternative = async () => {
    setRegenerating('alternative');
    setRegenerateError(null);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/artifacts/${artifact.id}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'appendAlternative' }),
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate alternative');
      }
      // Update LOCAL form state only (not saved yet)
      setFormData(prev => ({
        ...prev,
        content: data.contentMarkdown,
      }));
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setRegenerating(null);
    }
  };

  // Copilot: Generate suggestion
  const handleCopilotGenerate = async () => {
    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotSuggestion(null);
    setCopilotNotes([]);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/artifacts/${artifact.id}/copilot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intent: copilotIntent,
            userPrompt: copilotPrompt,
            applyMode,
            currentContent: formData.content,
            artifactType: artifact.type,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate suggestion');
      }
      setCopilotSuggestion(data.suggestedContent);
      if (data.notes) {
        setCopilotNotes(data.notes);
      }
    } catch (err) {
      setCopilotError(err instanceof Error ? err.message : 'Copilot failed');
    } finally {
      setCopilotLoading(false);
    }
  };

  // Apply copilot suggestion to local content
  const handleApplySuggestion = () => {
    if (!copilotSuggestion) return;

    setFormData(prev => {
      switch (applyMode) {
        case 'replace':
          return { ...prev, content: copilotSuggestion };
        case 'append':
          return { ...prev, content: prev.content + '\n\n---\n\n' + copilotSuggestion };
        case 'insert':
          // For insert, we'd need cursor position - default to append for now
          return { ...prev, content: prev.content + '\n\n' + copilotSuggestion };
        default:
          return prev;
      }
    });

    // Clear copilot state after applying
    setCopilotSuggestion(null);
    setCopilotNotes([]);
    setCopilotPrompt('');
  };

  // Dismiss suggestion without applying
  const handleDismissSuggestion = () => {
    setCopilotSuggestion(null);
    setCopilotNotes([]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-slate-900 border border-slate-800 rounded-xl w-full max-h-[90vh] overflow-hidden flex ${copilotOpen ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {/* Main Editor Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-cyan-400" />
                Edit Artifact
                {isModified && (
                  <span className="text-xs text-amber-400 ml-2">(unsaved changes)</span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setCopilotOpen(!copilotOpen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  copilotOpen
                    ? 'text-purple-300 bg-purple-500/20 border border-purple-500/30'
                    : 'text-slate-400 bg-slate-800/50 border border-slate-700 hover:border-purple-500/30 hover:text-purple-300'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                Copilot
              </button>
            </div>

            {/* AI-generated starting point badge */}
            {isAiGenerated && (
              <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-300">AI-generated starting point</span>
                </div>
                <p className="text-xs text-slate-400">
                  Edit freely — this won&apos;t affect the canonical strategy until you promote.
                </p>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-auto p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50"
                autoFocus
              />
            </div>

            {/* AI Regenerate Tools (legacy - keep for quick actions) */}
            <div className="flex items-center gap-2 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
              <RefreshCw className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-slate-400 flex-1">Quick AI (local only)</span>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={!!regenerating || loading || copilotLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded hover:bg-purple-500/20 disabled:opacity-50 transition-colors"
              >
                {regenerating === 'replace' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Regenerate
              </button>
              <button
                type="button"
                onClick={handleSuggestAlternative}
                disabled={!!regenerating || loading || copilotLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
              >
                {regenerating === 'alternative' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlusCircle className="w-3.5 h-3.5" />
                )}
                Add alternative
              </button>
            </div>

            {/* Regenerate Error */}
            {regenerateError && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-400">{regenerateError}</p>
              </div>
            )}

            {/* Content */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Content (Markdown)
              </label>
              <textarea
                value={formData.content}
                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={16}
                className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none font-mono"
              />
            </div>
          </form>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-800 flex justify-between items-center">
            <p className="text-xs text-slate-500">
              {isModified ? 'Click Save to persist changes' : 'No changes made'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.title.trim() || loading || !isModified}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Copilot Panel */}
        {copilotOpen && (
          <div className="w-96 border-l border-slate-800 flex flex-col bg-slate-900/50">
            {/* Copilot Header */}
            <div className="p-4 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  Copilot
                </h3>
                <button
                  onClick={() => setCopilotOpen(false)}
                  className="p-1 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                AI suggestions stay local until you save
              </p>
            </div>

            {/* Copilot Content */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Intent Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  What do you want to do?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {COPILOT_INTENTS.map(intent => {
                    const Icon = intent.icon;
                    return (
                      <button
                        key={intent.id}
                        type="button"
                        onClick={() => setCopilotIntent(intent.id)}
                        className={`p-2 text-left rounded-lg border transition-colors ${
                          copilotIntent === intent.id
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                            : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{intent.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{intent.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User Prompt */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Additional guidance (optional)
                </label>
                <textarea
                  value={copilotPrompt}
                  onChange={e => setCopilotPrompt(e.target.value)}
                  placeholder="e.g., Focus on Q1 priorities, emphasize ROI..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>

              {/* Apply Mode */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  How to apply
                </label>
                <div className="flex gap-2">
                  {(['replace', 'append'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setApplyMode(mode)}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded border transition-colors ${
                        applyMode === mode
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                          : 'bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {mode === 'replace' ? 'Replace all' : 'Append'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleCopilotGenerate}
                disabled={copilotLoading || loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-500 rounded-lg hover:bg-purple-400 disabled:opacity-50 transition-colors"
              >
                {copilotLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Suggestion
                  </>
                )}
              </button>

              {/* Copilot Error */}
              {copilotError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-xs text-red-400">{copilotError}</p>
                </div>
              )}

              {/* Suggestion Preview */}
              {copilotSuggestion && (
                <div className="space-y-3">
                  {/* Notes */}
                  {copilotNotes.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-amber-400">Notes</span>
                      </div>
                      <ul className="text-xs text-slate-400 space-y-0.5">
                        {copilotNotes.map((note, i) => (
                          <li key={i}>• {note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Diff Preview */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Changes Preview
                    </label>
                    <DiffPreview
                      original={formData.content}
                      suggested={copilotSuggestion}
                      maxHeight="200px"
                      showLineNumbers={false}
                    />
                  </div>

                  {/* Apply/Dismiss Actions */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDismissSuggestion}
                      className="flex-1 px-3 py-2 text-xs font-medium text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg hover:text-slate-300 transition-colors"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={handleApplySuggestion}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Apply {applyMode === 'replace' ? 'Replace' : 'Append'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
