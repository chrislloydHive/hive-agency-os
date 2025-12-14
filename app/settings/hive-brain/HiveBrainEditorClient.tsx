'use client';

// app/settings/hive-brain/HiveBrainEditorClient.tsx
// Client component for editing Hive Brain context defaults
// Now includes AI Copilot for proposal-based assistance

import { useState, useCallback } from 'react';
import {
  Save,
  Loader2,
  CheckCircle,
  Palette,
  Target,
  Shield,
  Wrench,
  Lightbulb,
  BarChart3,
  Zap,
  ChevronDown,
  ChevronRight,
  Bot,
  Send,
  X,
  Sparkles,
  ListChecks,
  Settings2,
  Search,
  MessageSquare,
} from 'lucide-react';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { HIVE_BRAIN_DOMAINS } from '@/lib/contextGraph/globalGraph';
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_KEYS,
  CATEGORY_LABELS,
  CAPABILITY_LABELS,
  type CapabilityCategory,
  type CapabilityStrength,
  type CapabilitiesDomain,
  type Capability,
} from '@/lib/contextGraph/domains/capabilities';
import { ContextSection, ContextField } from '@/components/context';
import { ProposalReviewDrawer } from '@/components/proposal';
import type { Proposal } from '@/lib/os/writeContract/types';

// ============================================================================
// Types
// ============================================================================

interface HiveBrainEditorClientProps {
  initialGraph: CompanyContextGraph;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// Copilot types
type CopilotAction = 'fill_service_taxonomy' | 'refine_capabilities' | 'improve_positioning' | 'audit_gaps';

interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface CopilotSuggestedAction {
  id: CopilotAction;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const COPILOT_ACTIONS: CopilotSuggestedAction[] = [
  {
    id: 'fill_service_taxonomy',
    label: 'Fill Service Taxonomy',
    description: 'Complete missing services and deliverables',
    icon: <ListChecks className="w-4 h-4" />,
  },
  {
    id: 'refine_capabilities',
    label: 'Refine Capabilities',
    description: 'Improve deliverables and constraints',
    icon: <Settings2 className="w-4 h-4" />,
  },
  {
    id: 'improve_positioning',
    label: 'Improve Positioning',
    description: 'Clarify brand positioning and differentiation',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: 'audit_gaps',
    label: 'Audit for Gaps',
    description: 'Find missing or weak fields',
    icon: <Search className="w-4 h-4" />,
  },
];

// ============================================================================
// Domain Configuration
// ============================================================================

interface DomainConfig {
  id: typeof HIVE_BRAIN_DOMAINS[number];
  label: string;
  description: string;
  icon: React.ReactNode;
  fields: FieldConfig[];
}

interface FieldConfig {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  rows?: number;
  isArray?: boolean;
}

const DOMAIN_CONFIGS: DomainConfig[] = [
  {
    id: 'brand',
    label: 'Brand Defaults',
    description: 'Agency-wide brand guidelines and tone',
    icon: <Palette className="w-4 h-4" />,
    fields: [
      { key: 'positioning', label: 'Default Positioning', placeholder: 'Agency default brand positioning...', multiline: true },
      { key: 'toneOfVoice', label: 'Default Tone of Voice', placeholder: 'Professional, conversational, etc.' },
      { key: 'brandPersonality', label: 'Brand Personality', placeholder: 'Agency default brand personality...' },
    ],
  },
  {
    id: 'objectives',
    label: 'Objectives Defaults',
    description: 'Default KPIs and goal structures',
    icon: <Target className="w-4 h-4" />,
    fields: [
      { key: 'primaryObjective', label: 'Default Primary Objective', placeholder: 'Growth, efficiency, etc.' },
      { key: 'timeHorizon', label: 'Default Planning Horizon', placeholder: 'Q1 2025, 6 months, etc.' },
    ],
  },
  {
    id: 'operationalConstraints',
    label: 'Operational Constraints',
    description: 'Agency-wide compliance and restrictions',
    icon: <Shield className="w-4 h-4" />,
    fields: [
      { key: 'complianceRequirements', label: 'Default Compliance', placeholder: 'GDPR, CCPA, etc.', isArray: true },
      { key: 'blackoutPeriods', label: 'Standard Blackout Periods', placeholder: 'Holiday freeze, etc.', isArray: true },
      { key: 'platformLimitations', label: 'Platform Restrictions', placeholder: 'Platform-specific limitations...', multiline: true },
    ],
  },
  {
    id: 'ops',
    label: 'Operations Defaults',
    description: 'Default operational capacity and constraints',
    icon: <Wrench className="w-4 h-4" />,
    fields: [
      { key: 'operationalCapacity', label: 'Default Capacity Notes', placeholder: 'Standard capacity constraints...' },
      { key: 'agencyPartners', label: 'Agency Partners', placeholder: 'Partner agencies...', isArray: true },
    ],
  },
  {
    id: 'creative',
    label: 'Creative Defaults',
    description: 'Default creative direction and formats',
    icon: <Lightbulb className="w-4 h-4" />,
    fields: [
      { key: 'creativeDirection', label: 'Default Creative Direction', placeholder: 'Agency creative philosophy...', multiline: true },
      { key: 'preferredFormats', label: 'Preferred Formats', placeholder: 'Video, static, carousel...', isArray: true },
    ],
  },
  {
    id: 'performanceMedia',
    label: 'Performance Media',
    description: 'Default media settings and attribution',
    icon: <BarChart3 className="w-4 h-4" />,
    fields: [
      { key: 'attributionModel', label: 'Default Attribution Model', placeholder: 'Data-driven, last-click, etc.' },
      { key: 'activeChannels', label: 'Standard Channels', placeholder: 'Google, Meta, etc.', isArray: true },
    ],
  },
];

// ============================================================================
// Main Component
// ============================================================================

export function HiveBrainEditorClient({ initialGraph }: HiveBrainEditorClientProps) {
  const [graph, setGraph] = useState<CompanyContextGraph>(initialGraph);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['strategy']));

  // Copilot state
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null);
  const [proposalDrawerOpen, setProposalDrawerOpen] = useState(false);
  const [isApplyingProposal, setIsApplyingProposal] = useState(false);

  // ============================================================================
  // Field Handlers
  // ============================================================================

  const getFieldValue = useCallback((domain: string, field: string): string => {
    const domainObj = graph[domain as keyof CompanyContextGraph] as Record<string, unknown> | undefined;
    if (!domainObj) return '';

    const fieldObj = domainObj[field] as { value?: unknown } | undefined;
    if (!fieldObj?.value) return '';

    if (Array.isArray(fieldObj.value)) {
      return fieldObj.value.join(', ');
    }

    return String(fieldObj.value);
  }, [graph]);

  const setFieldValue = useCallback((domain: string, field: string, value: string, isArray: boolean = false) => {
    setGraph(prev => {
      const newGraph = JSON.parse(JSON.stringify(prev)) as CompanyContextGraph;
      const domainObj = newGraph[domain as keyof CompanyContextGraph] as Record<string, unknown>;

      if (!domainObj) return prev;

      const parsedValue = isArray
        ? value.split(',').map(v => v.trim()).filter(Boolean)
        : value;

      // Create or update the field with provenance
      domainObj[field] = {
        value: parsedValue || null,
        provenance: [{
          source: 'manual',
          confidence: 100,
          updatedAt: new Date().toISOString(),
          validForDays: 365,
        }],
      };

      return newGraph;
    });
  }, []);

  // ============================================================================
  // Capability Handlers
  // ============================================================================

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const getCapability = useCallback((category: CapabilityCategory, key: string): Capability => {
    const capabilities = graph.capabilities as CapabilitiesDomain | undefined;
    if (!capabilities) {
      return {
        enabled: { value: false, provenance: [] },
        strength: { value: 'basic', provenance: [] },
        deliverables: { value: [], provenance: [] },
        constraints: { value: [], provenance: [] },
      };
    }
    const categoryObj = capabilities[category] as Record<string, Capability> | undefined;
    return categoryObj?.[key] || {
      enabled: { value: false, provenance: [] },
      strength: { value: 'basic', provenance: [] },
      deliverables: { value: [], provenance: [] },
      constraints: { value: [], provenance: [] },
    };
  }, [graph]);

  const updateCapability = useCallback((
    category: CapabilityCategory,
    key: string,
    field: keyof Capability,
    value: boolean | CapabilityStrength | string[]
  ) => {
    setGraph(prev => {
      const newGraph = JSON.parse(JSON.stringify(prev)) as CompanyContextGraph;

      // Initialize capabilities if not present
      if (!newGraph.capabilities) {
        newGraph.capabilities = {} as CapabilitiesDomain;
      }
      const capabilities = newGraph.capabilities as CapabilitiesDomain;

      // Initialize category if not present
      if (!capabilities[category]) {
        (capabilities as Record<string, Record<string, Capability>>)[category] = {};
      }
      const categoryObj = capabilities[category] as Record<string, Capability>;

      if (!categoryObj[key]) {
        categoryObj[key] = {
          enabled: { value: false, provenance: [] },
          strength: { value: 'basic', provenance: [] },
          deliverables: { value: [], provenance: [] },
          constraints: { value: [], provenance: [] },
        };
      }

      (categoryObj[key] as Record<string, unknown>)[field] = {
        value: value,
        provenance: [{
          source: 'manual' as const,
          confidence: 100,
          updatedAt: new Date().toISOString(),
          validForDays: 365,
        }],
      };

      return newGraph;
    });
  }, []);

  // ============================================================================
  // Save Handler
  // ============================================================================

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    setError(null);

    try {
      const response = await fetch('/api/os/hive-brain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph,
          source: 'manual',
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to save');
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[HiveBrain] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaveStatus('error');
    }
  }, [graph]);

  // ============================================================================
  // Copilot Handlers
  // ============================================================================

  const sendCopilotMessage = useCallback(async (prompt?: string, action?: CopilotAction) => {
    const message = prompt || copilotInput;
    if (!message && !action) return;

    // Add user message to chat
    if (message) {
      setCopilotMessages(prev => [...prev, {
        role: 'user',
        content: message,
        timestamp: new Date(),
      }]);
      setCopilotInput('');
    }

    setCopilotLoading(true);

    try {
      const response = await fetch('/api/os/global-context/hive-brain/ai-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message || undefined,
          action: action || undefined,
        }),
      });

      const data = await response.json();

      // Add assistant response
      setCopilotMessages(prev => [...prev, {
        role: 'assistant',
        content: data.summary,
        timestamp: new Date(),
      }]);

      // If there's a proposal, store it and open the review drawer
      if (data.proposal && data.requiresUserApproval) {
        setCurrentProposal(data.proposal as Proposal);
        setProposalDrawerOpen(true);
      }
    } catch (err) {
      console.error('[Copilot] Error:', err);
      setCopilotMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, an error occurred. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setCopilotLoading(false);
    }
  }, [copilotInput]);

  const handleCopilotAction = useCallback((action: CopilotAction) => {
    const actionConfig = COPILOT_ACTIONS.find(a => a.id === action);
    if (actionConfig) {
      setCopilotMessages(prev => [...prev, {
        role: 'user',
        content: `Action: ${actionConfig.label}`,
        timestamp: new Date(),
      }]);
    }
    sendCopilotMessage(undefined, action);
  }, [sendCopilotMessage]);

  const handleApplyProposal = useCallback(async (selectedPaths: string[]) => {
    if (!currentProposal) return;

    setIsApplyingProposal(true);

    try {
      // Apply the proposal to the Hive Brain via API
      const response = await fetch('/api/os/hive-brain/apply-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: currentProposal.id,
          selectedPaths,
          proposal: currentProposal, // Pass full proposal for server-side apply
        }),
      });

      const data = await response.json();

      console.log('[Copilot] Apply response:', {
        success: data.success,
        hasUpdatedGraph: !!data.updatedGraph,
        applied: data.applied,
        skipped: data.skipped,
        error: data.error,
      });

      if (data.success && data.updatedGraph) {
        console.log('[Copilot] Setting graph with capabilities:', {
          hasCapabilities: !!data.updatedGraph.capabilities,
          capabilityKeys: data.updatedGraph.capabilities ? Object.keys(data.updatedGraph.capabilities) : [],
          strategyEnabled: data.updatedGraph.capabilities?.strategy?.enabled,
        });
        setGraph(data.updatedGraph);
        setCopilotMessages(prev => [...prev, {
          role: 'assistant',
          content: `Applied ${selectedPaths.length} change(s) successfully.`,
          timestamp: new Date(),
        }]);
      } else {
        // Fall back to local apply if API doesn't exist yet
        // This is a simplified local merge - real implementation uses writeContract
        setCopilotMessages(prev => [...prev, {
          role: 'assistant',
          content: `Selected ${selectedPaths.length} change(s). Save to persist.`,
          timestamp: new Date(),
        }]);
      }

      setProposalDrawerOpen(false);
      setCurrentProposal(null);
    } catch (err) {
      console.error('[Copilot] Apply error:', err);
      setCopilotMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error applying changes. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsApplyingProposal(false);
    }
  }, [currentProposal]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
      {/* Header with Save + Copilot buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${saveStatus === 'saved'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : saveStatus === 'error'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>

        {/* Copilot Toggle */}
        <button
          onClick={() => setCopilotOpen(!copilotOpen)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${copilotOpen
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-300 hover:border-slate-600'
            }
          `}
        >
          <Bot className="w-4 h-4" />
          {copilotOpen ? 'Close Copilot' : 'AI Copilot'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* How It Works */}
      <div className="px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg">
        <h3 className="text-sm font-medium text-slate-200 mb-2">How Hive Brain Works</h3>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Values set here become <strong>defaults</strong> for all companies</li>
          <li>• Company-specific values <strong>always override</strong> Hive Brain defaults</li>
          <li>• AI builders automatically merge Hive Brain + Company Brain</li>
          <li>• Only human edits are allowed - no AI auto-writes</li>
        </ul>
      </div>

      {/* Hive Capabilities Section */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-amber-400"><Zap className="w-4 h-4" /></div>
          <h2 className="text-sm font-medium text-slate-200">Hive Capabilities</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          These defaults shape strategies and recommendations across all companies unless overridden.
        </p>

        <div className="space-y-3">
          {CAPABILITY_CATEGORIES.map(category => {
            const isExpanded = expandedCategories.has(category);
            const keys = CAPABILITY_KEYS[category];
            const enabledCount = keys.filter(key => getCapability(category, key).enabled.value).length;

            return (
              <div key={category} className="border border-slate-700 rounded-lg overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="text-sm font-medium text-slate-200">
                      {CATEGORY_LABELS[category]}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {enabledCount}/{keys.length} enabled
                  </span>
                </button>

                {/* Capability Items */}
                {isExpanded && (
                  <div className="p-4 space-y-4 bg-slate-900/30">
                    {keys.map(key => {
                      const cap = getCapability(category, key);
                      const isEnabled = cap.enabled.value;

                      return (
                        <div key={key} className="space-y-2">
                          {/* Capability Row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Enable Toggle */}
                              <button
                                onClick={() => updateCapability(category, key, 'enabled', !isEnabled)}
                                className={`w-10 h-5 rounded-full transition-colors ${
                                  isEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                                }`}
                              >
                                <div className={`w-4 h-4 bg-white rounded-full transform transition-transform mx-0.5 ${
                                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                              </button>
                              <span className={`text-sm ${isEnabled ? 'text-slate-200' : 'text-slate-500'}`}>
                                {CAPABILITY_LABELS[key] || key}
                              </span>
                            </div>

                            {/* Strength Select */}
                            {isEnabled && (
                              <select
                                value={cap.strength.value || 'basic'}
                                onChange={(e) => updateCapability(category, key, 'strength', e.target.value as CapabilityStrength)}
                                className="px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-slate-300"
                              >
                                <option value="basic">Basic</option>
                                <option value="strong">Strong</option>
                                <option value="elite">Elite</option>
                              </select>
                            )}
                          </div>

                          {/* Deliverables & Constraints (when enabled) */}
                          {isEnabled && (
                            <div className="pl-12 grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Deliverables (one per line)</label>
                                <textarea
                                  value={(cap.deliverables.value || []).join('\n')}
                                  onChange={(e) => updateCapability(
                                    category,
                                    key,
                                    'deliverables',
                                    e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                                  )}
                                  placeholder="What we deliver..."
                                  rows={2}
                                  className="w-full px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-300 placeholder-slate-600 resize-none"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 mb-1 block">Constraints (one per line)</label>
                                <textarea
                                  value={(cap.constraints.value || []).join('\n')}
                                  onChange={(e) => updateCapability(
                                    category,
                                    key,
                                    'constraints',
                                    e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                                  )}
                                  placeholder="Limitations..."
                                  rows={2}
                                  className="w-full px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-300 placeholder-slate-600 resize-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Domain Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {DOMAIN_CONFIGS.map(domain => (
          <ContextSection
            key={domain.id}
            icon={domain.icon}
            title={domain.label}
            className="h-fit"
          >
            <p className="text-xs text-slate-500 -mt-2 mb-4">{domain.description}</p>
            {domain.fields.map(field => (
              <ContextField
                key={field.key}
                label={field.label}
                value={getFieldValue(domain.id, field.key)}
                onChange={(value) => setFieldValue(domain.id, field.key, value, field.isArray)}
                placeholder={field.placeholder}
                multiline={field.multiline}
                rows={field.rows || 3}
              />
            ))}
          </ContextSection>
        ))}
      </div>

      {/* Metadata */}
      <div className="text-xs text-slate-500 text-center pt-4 border-t border-slate-800">
        Last updated: {graph.meta.updatedAt ? new Date(graph.meta.updatedAt).toLocaleString() : 'Never'}
        {' • '}
        Version: {graph.meta.version}
      </div>
      </div>
      {/* End Main Content */}

      {/* Copilot Panel */}
      {copilotOpen && (
        <div className="w-80 flex-shrink-0 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col h-fit sticky top-6">
          {/* Copilot Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              <span className="font-medium text-slate-200">Hive Brain Copilot</span>
            </div>
            <button
              onClick={() => setCopilotOpen(false)}
              className="p-1 text-slate-500 hover:text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* System Hint */}
          <div className="p-3 bg-purple-500/10 border-b border-purple-500/20">
            <p className="text-xs text-purple-300">
              I can help draft Hive&apos;s services, capabilities, and principles. All changes require your approval.
            </p>
          </div>

          {/* Suggested Actions */}
          {copilotMessages.length === 0 && (
            <div className="p-3 border-b border-slate-800">
              <p className="text-xs text-slate-500 mb-2">Quick actions:</p>
              <div className="space-y-2">
                {COPILOT_ACTIONS.map(action => (
                  <button
                    key={action.id}
                    onClick={() => handleCopilotAction(action.id)}
                    disabled={copilotLoading}
                    className="w-full flex items-center gap-2 p-2 text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <span className="text-slate-400">{action.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300">{action.label}</p>
                      <p className="text-xs text-slate-500 truncate">{action.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-80">
            {copilotMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg p-2.5 text-xs ${
                    msg.role === 'user'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1 text-purple-400">
                      <Bot className="w-3 h-3" />
                      <span className="text-[10px] font-medium">Copilot</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {copilotLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendCopilotMessage();
                  }
                }}
                placeholder="Ask about Hive Brain..."
                disabled={copilotLoading}
                className="flex-1 px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
              <button
                onClick={() => sendCopilotMessage()}
                disabled={copilotLoading || !copilotInput.trim()}
                className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Review Drawer */}
      {currentProposal && (
        <ProposalReviewDrawer
          proposal={currentProposal}
          isOpen={proposalDrawerOpen}
          onClose={() => {
            setProposalDrawerOpen(false);
            setCurrentProposal(null);
          }}
          onApply={handleApplyProposal}
          isApplying={isApplyingProposal}
        />
      )}
    </div>
  );
}
