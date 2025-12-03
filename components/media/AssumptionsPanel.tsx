'use client';

// components/media/AssumptionsPanel.tsx
// Growth Assumptions Panel - Collapsible left-hand panel for editing forecast assumptions
//
// Features:
// - Collapsible sections for each channel type
// - Editable fields with defaults
// - AI Autofill button for industry benchmarks
// - Store-level modifier table
// - Seasonality toggles

import { useState, useCallback } from 'react';
import {
  type MediaAssumptions,
  type SearchAssumptions,
  type SocialAssumptions,
  type LSAAssumptions,
  type MapsAssumptions,
  type DisplayAssumptions,
  type SeasonalityModifier,
  type StoreModifier,
  type MarketType,
  type CompetitionLevel,
  createDefaultAssumptions,
  SEASON_CONFIG,
  MARKET_TYPE_DEFAULTS,
  COMPETITION_LEVEL_DEFAULTS,
  calculateStoreModifier,
} from '@/lib/media/assumptions';

// ============================================================================
// Types
// ============================================================================

interface AssumptionsPanelProps {
  companyId: string;
  assumptions: MediaAssumptions | null;
  onUpdate: (assumptions: MediaAssumptions) => void;
  onSave: (assumptions: MediaAssumptions) => Promise<void>;
  onAISuggest?: () => Promise<Partial<MediaAssumptions> | null>;
  stores?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
  isSaving?: boolean;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
}

interface NumberInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  description?: string;
  isPercent?: boolean;
  isCurrency?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  badge,
}: CollapsibleSectionProps) {
  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-slate-200">{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {badge}
            </span>
          )}
        </div>
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen && (
        <div className="p-3 space-y-3 bg-slate-900/50 border-t border-slate-700/50">
          {children}
        </div>
      )}
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 0.01,
  suffix,
  description,
  isPercent,
  isCurrency,
}: NumberInputProps) {
  const displayValue = isPercent && value !== undefined ? value * 100 : value;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseFloat(e.target.value);
    if (!isNaN(rawValue)) {
      onChange(isPercent ? rawValue / 100 : rawValue);
    }
  };

  return (
    <div className="space-y-1">
      <label className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        {suffix && <span className="text-[10px] text-slate-500">{suffix}</span>}
      </label>
      <div className="relative">
        {isCurrency && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
        )}
        <input
          type="number"
          value={displayValue ?? ''}
          onChange={handleChange}
          min={isPercent ? (min ?? 0) * 100 : min}
          max={isPercent && max ? max * 100 : max}
          step={isPercent ? step * 100 : step}
          className={`w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-blue-500 ${
            isCurrency ? 'pl-5' : ''
          } ${isPercent ? 'pr-6' : ''}`}
        />
        {isPercent && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
        )}
      </div>
      {description && <p className="text-[10px] text-slate-500">{description}</p>}
    </div>
  );
}

// Channel Icons
function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function SocialIcon() {
  return (
    <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function LSAIcon() {
  return (
    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function MapsIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SeasonIcon() {
  return (
    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

// ============================================================================
// Section Components
// ============================================================================

interface SearchSectionProps {
  assumptions: SearchAssumptions;
  onChange: (updates: Partial<SearchAssumptions>) => void;
}

function SearchSection({ assumptions, onChange }: SearchSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberInput
        label="CTR"
        value={assumptions.ctr}
        onChange={(v) => onChange({ ctr: v })}
        isPercent
        max={0.20}
        description="Click-through rate"
      />
      <NumberInput
        label="CPC"
        value={assumptions.cpc}
        onChange={(v) => onChange({ cpc: v })}
        isCurrency
        description="Cost per click"
      />
      <NumberInput
        label="Conversion Rate"
        value={assumptions.conversionRate}
        onChange={(v) => onChange({ conversionRate: v })}
        isPercent
        max={0.30}
        description="Click to lead"
      />
      <NumberInput
        label="Assisted Conv."
        value={assumptions.assistedConversions}
        onChange={(v) => onChange({ assistedConversions: v })}
        isPercent
        max={0.50}
        description="With assist path"
      />
    </div>
  );
}

interface SocialSectionProps {
  assumptions: SocialAssumptions;
  onChange: (updates: Partial<SocialAssumptions>) => void;
}

function SocialSection({ assumptions, onChange }: SocialSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberInput
        label="CPM"
        value={assumptions.cpm}
        onChange={(v) => onChange({ cpm: v })}
        isCurrency
        description="Cost per 1000 impressions"
      />
      <NumberInput
        label="CTR"
        value={assumptions.ctr}
        onChange={(v) => onChange({ ctr: v })}
        isPercent
        max={0.10}
        description="Click-through rate"
      />
      <NumberInput
        label="CPC"
        value={assumptions.cpc}
        onChange={(v) => onChange({ cpc: v })}
        isCurrency
        description="Cost per click"
      />
      <NumberInput
        label="Conversion Rate"
        value={assumptions.conversionRate}
        onChange={(v) => onChange({ conversionRate: v })}
        isPercent
        max={0.15}
        description="Click to lead"
      />
      <div className="col-span-2">
        <NumberInput
          label="Creative Fatigue Modifier"
          value={assumptions.creativeFatigueModifier}
          onChange={(v) => onChange({ creativeFatigueModifier: v })}
          isPercent
          min={0.5}
          max={1.0}
          description="Performance after 4 weeks (lower = more fatigue)"
        />
      </div>
    </div>
  );
}

interface LSASectionProps {
  assumptions: LSAAssumptions;
  onChange: (updates: Partial<LSAAssumptions>) => void;
}

function LSASection({ assumptions, onChange }: LSASectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberInput
        label="Cost Per Lead"
        value={assumptions.costPerLead}
        onChange={(v) => onChange({ costPerLead: v })}
        isCurrency
        description="Google charges per lead"
      />
      <NumberInput
        label="Lead Quality Score"
        value={assumptions.leadQualityScore}
        onChange={(v) => onChange({ leadQualityScore: v })}
        min={0}
        max={100}
        step={1}
        suffix="0-100"
        description="Quality rating"
      />
      <div className="col-span-2">
        <NumberInput
          label="Dispute Rate"
          value={assumptions.disputeRate}
          onChange={(v) => onChange({ disputeRate: v })}
          isPercent
          max={0.30}
          description="Leads disputed/refunded"
        />
      </div>
    </div>
  );
}

interface MapsSectionProps {
  assumptions: MapsAssumptions;
  onChange: (updates: Partial<MapsAssumptions>) => void;
}

function MapsSection({ assumptions, onChange }: MapsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberInput
        label="Actions/Impression"
        value={assumptions.actionsPerImpression}
        onChange={(v) => onChange({ actionsPerImpression: v })}
        isPercent
        max={0.10}
        description="Calls + directions"
      />
      <NumberInput
        label="Photo Impact"
        value={assumptions.photoImpactMultiplier}
        onChange={(v) => onChange({ photoImpactMultiplier: v })}
        min={0.5}
        max={2.0}
        step={0.05}
        suffix="1.0x"
        description="Photo quality multiplier"
      />
      <div className="col-span-2">
        <NumberInput
          label="Rating Multiplier"
          value={assumptions.ratingMultiplier}
          onChange={(v) => onChange({ ratingMultiplier: v })}
          min={0.5}
          max={2.0}
          step={0.05}
          suffix="1.0x"
          description="Rating impact on conversions"
        />
      </div>
    </div>
  );
}

interface SeasonalitySectionProps {
  seasonality: MediaAssumptions['seasonality'];
  onChange: (updates: Partial<MediaAssumptions['seasonality']>) => void;
}

function SeasonalitySection({ seasonality, onChange }: SeasonalitySectionProps) {
  const seasons: Array<{ key: keyof typeof seasonality; config: typeof SEASON_CONFIG[keyof typeof SEASON_CONFIG] }> = [
    { key: 'remoteStart', config: SEASON_CONFIG.remote_start },
    { key: 'holiday', config: SEASON_CONFIG.holiday },
    { key: 'carplaySeason', config: SEASON_CONFIG.carplay_season },
    { key: 'summerAudio', config: SEASON_CONFIG.summer_audio },
  ];

  const handleSeasonToggle = (key: keyof typeof seasonality, enabled: boolean) => {
    const current = seasonality[key];
    if (current) {
      onChange({ [key]: { ...current, enabled } });
    }
  };

  const handleSeasonUpdate = (key: keyof typeof seasonality, updates: Partial<SeasonalityModifier>) => {
    const current = seasonality[key];
    if (current) {
      onChange({ [key]: { ...current, ...updates } });
    }
  };

  return (
    <div className="space-y-3">
      {seasons.map(({ key, config }) => {
        const modifier = seasonality[key];
        if (!modifier) return null;

        return (
          <div key={key} className="p-2 rounded border border-slate-700/50 bg-slate-800/30">
            <label className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modifier.enabled}
                  onChange={(e) => handleSeasonToggle(key, e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs font-medium text-slate-200">{config.label}</span>
              </div>
              <span className="text-[10px] text-slate-500">{config.months}</span>
            </label>

            {modifier.enabled && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <NumberInput
                  label="Spend Lift"
                  value={modifier.spendLiftPercent / 100}
                  onChange={(v) => handleSeasonUpdate(key, { spendLiftPercent: v * 100 })}
                  isPercent
                  min={-0.5}
                  max={2.0}
                />
                <NumberInput
                  label="Conv. Lift"
                  value={modifier.conversionLiftPercent / 100}
                  onChange={(v) => handleSeasonUpdate(key, { conversionLiftPercent: v * 100 })}
                  isPercent
                  min={-0.5}
                  max={1.0}
                />
                <NumberInput
                  label="CPC Change"
                  value={modifier.cpcChangePercent / 100}
                  onChange={(v) => handleSeasonUpdate(key, { cpcChangePercent: v * 100 })}
                  isPercent
                  min={-0.3}
                  max={1.0}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface StoreModifiersSectionProps {
  modifiers: StoreModifier[];
  stores: Array<{ id: string; name: string }>;
  onChange: (modifiers: StoreModifier[]) => void;
}

function StoreModifiersSection({ modifiers, stores, onChange }: StoreModifiersSectionProps) {
  const handleAddStore = (storeId: string, storeName: string) => {
    if (modifiers.find(m => m.storeId === storeId)) return;

    const defaultMods = calculateStoreModifier('suburban', 'medium');
    onChange([
      ...modifiers,
      {
        storeId,
        storeName,
        marketType: 'suburban',
        competitionLevel: 'medium',
        costModifier: defaultMods.costModifier,
        conversionModifier: defaultMods.conversionModifier,
      },
    ]);
  };

  const handleUpdateModifier = (storeId: string, updates: Partial<StoreModifier>) => {
    onChange(
      modifiers.map(m => {
        if (m.storeId !== storeId) return m;

        const updated = { ...m, ...updates };

        // Recalculate modifiers if market type or competition changed
        if (updates.marketType || updates.competitionLevel) {
          const calculated = calculateStoreModifier(
            updates.marketType ?? m.marketType,
            updates.competitionLevel ?? m.competitionLevel
          );
          updated.costModifier = calculated.costModifier;
          updated.conversionModifier = calculated.conversionModifier;
        }

        return updated;
      })
    );
  };

  const handleRemoveModifier = (storeId: string) => {
    onChange(modifiers.filter(m => m.storeId !== storeId));
  };

  const availableStores = stores.filter(s => !modifiers.find(m => m.storeId === s.id));

  return (
    <div className="space-y-3">
      {modifiers.length > 0 && (
        <div className="space-y-2">
          {modifiers.map((modifier) => (
            <div key={modifier.storeId} className="p-2 rounded border border-slate-700/50 bg-slate-800/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-200">{modifier.storeName}</span>
                <button
                  onClick={() => handleRemoveModifier(modifier.storeId)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-slate-500">Market Type</label>
                  <select
                    value={modifier.marketType}
                    onChange={(e) => handleUpdateModifier(modifier.storeId, { marketType: e.target.value as MarketType })}
                    className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200"
                  >
                    <option value="urban">Urban</option>
                    <option value="suburban">Suburban</option>
                    <option value="rural">Rural</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500">Competition</label>
                  <select
                    value={modifier.competitionLevel}
                    onChange={(e) => handleUpdateModifier(modifier.storeId, { competitionLevel: e.target.value as CompetitionLevel })}
                    className="w-full px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="very_high">Very High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-1.5 rounded bg-slate-900/50">
                  <span className="text-[10px] text-slate-500 block">Cost Mod</span>
                  <span className={`text-xs font-medium ${modifier.costModifier > 1 ? 'text-red-400' : modifier.costModifier < 1 ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {modifier.costModifier.toFixed(2)}x
                  </span>
                </div>
                <div className="text-center p-1.5 rounded bg-slate-900/50">
                  <span className="text-[10px] text-slate-500 block">Conv. Mod</span>
                  <span className={`text-xs font-medium ${modifier.conversionModifier > 1 ? 'text-emerald-400' : modifier.conversionModifier < 1 ? 'text-red-400' : 'text-slate-300'}`}>
                    {modifier.conversionModifier.toFixed(2)}x
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {availableStores.length > 0 && (
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Add Store</label>
          <select
            onChange={(e) => {
              const store = stores.find(s => s.id === e.target.value);
              if (store) {
                handleAddStore(store.id, store.name);
                e.target.value = '';
              }
            }}
            className="w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-200"
            defaultValue=""
          >
            <option value="" disabled>Select a store...</option>
            {availableStores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>
      )}

      {stores.length === 0 && (
        <p className="text-[10px] text-slate-500 text-center py-2">
          No stores configured. Store modifiers will be available once stores are added.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AssumptionsPanel({
  companyId,
  assumptions: initialAssumptions,
  onUpdate,
  onSave,
  onAISuggest,
  stores = [],
  isLoading = false,
  isSaving = false,
}: AssumptionsPanelProps) {
  // Initialize with defaults if no assumptions provided
  const [assumptions, setAssumptions] = useState<MediaAssumptions>(
    initialAssumptions ?? createDefaultAssumptions(companyId)
  );

  // Section open states
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['search']) // Start with search open
  );

  const [isAISuggesting, setIsAISuggesting] = useState(false);

  const toggleSection = (section: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleUpdate = useCallback((updates: Partial<MediaAssumptions>) => {
    const updated = {
      ...assumptions,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    setAssumptions(updated);
    onUpdate(updated);
  }, [assumptions, onUpdate]);

  const handleSearchUpdate = useCallback((updates: Partial<SearchAssumptions>) => {
    handleUpdate({ search: { ...assumptions.search, ...updates } });
  }, [assumptions.search, handleUpdate]);

  const handleSocialUpdate = useCallback((updates: Partial<SocialAssumptions>) => {
    handleUpdate({ social: { ...assumptions.social, ...updates } });
  }, [assumptions.social, handleUpdate]);

  const handleLSAUpdate = useCallback((updates: Partial<LSAAssumptions>) => {
    handleUpdate({ lsa: { ...assumptions.lsa, ...updates } });
  }, [assumptions.lsa, handleUpdate]);

  const handleMapsUpdate = useCallback((updates: Partial<MapsAssumptions>) => {
    handleUpdate({ maps: { ...assumptions.maps, ...updates } });
  }, [assumptions.maps, handleUpdate]);

  const handleSeasonalityUpdate = useCallback((updates: Partial<MediaAssumptions['seasonality']>) => {
    handleUpdate({ seasonality: { ...assumptions.seasonality, ...updates } });
  }, [assumptions.seasonality, handleUpdate]);

  const handleStoreModifiersUpdate = useCallback((modifiers: StoreModifier[]) => {
    handleUpdate({ storeModifiers: modifiers });
  }, [handleUpdate]);

  const handleAISuggest = async () => {
    if (!onAISuggest) return;

    setIsAISuggesting(true);
    try {
      const suggestions = await onAISuggest();
      if (suggestions) {
        const updated: MediaAssumptions = {
          ...assumptions,
          search: { ...assumptions.search, ...suggestions.search },
          social: { ...assumptions.social, ...suggestions.social },
          lsa: { ...assumptions.lsa, ...suggestions.lsa },
          maps: { ...assumptions.maps, ...suggestions.maps },
          lastUpdated: new Date().toISOString(),
        };
        setAssumptions(updated);
        onUpdate(updated);
      }
    } finally {
      setIsAISuggesting(false);
    }
  };

  const handleSave = async () => {
    await onSave(assumptions);
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/50 border-r border-slate-800">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200 mb-2">Growth Assumptions</h2>

        <div className="flex gap-2">
          {onAISuggest && (
            <button
              onClick={handleAISuggest}
              disabled={isAISuggesting}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 text-purple-300 hover:border-purple-500/50 transition-colors disabled:opacity-50"
            >
              {isAISuggesting ? (
                <div className="animate-spin rounded-full h-3 w-3 border border-purple-400 border-t-transparent" />
              ) : (
                <SparklesIcon />
              )}
              AI Suggest
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:border-blue-500/50 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-3 w-3 border border-blue-400 border-t-transparent" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Save
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <CollapsibleSection
          title="Search"
          icon={<SearchIcon />}
          isOpen={openSections.has('search')}
          onToggle={() => toggleSection('search')}
          badge="Google Ads"
        >
          <SearchSection assumptions={assumptions.search} onChange={handleSearchUpdate} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Social"
          icon={<SocialIcon />}
          isOpen={openSections.has('social')}
          onToggle={() => toggleSection('social')}
          badge="Meta"
        >
          <SocialSection assumptions={assumptions.social} onChange={handleSocialUpdate} />
        </CollapsibleSection>

        <CollapsibleSection
          title="LSAs"
          icon={<LSAIcon />}
          isOpen={openSections.has('lsa')}
          onToggle={() => toggleSection('lsa')}
          badge="Local Services"
        >
          <LSASection assumptions={assumptions.lsa} onChange={handleLSAUpdate} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Maps / GBP"
          icon={<MapsIcon />}
          isOpen={openSections.has('maps')}
          onToggle={() => toggleSection('maps')}
          badge="Google Business"
        >
          <MapsSection assumptions={assumptions.maps} onChange={handleMapsUpdate} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Seasonality"
          icon={<SeasonIcon />}
          isOpen={openSections.has('seasonality')}
          onToggle={() => toggleSection('seasonality')}
        >
          <SeasonalitySection seasonality={assumptions.seasonality} onChange={handleSeasonalityUpdate} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Store Modifiers"
          icon={<StoreIcon />}
          isOpen={openSections.has('stores')}
          onToggle={() => toggleSection('stores')}
          badge={`${assumptions.storeModifiers.length}`}
        >
          <StoreModifiersSection
            modifiers={assumptions.storeModifiers}
            stores={stores}
            onChange={handleStoreModifiersUpdate}
          />
        </CollapsibleSection>
      </div>

      {/* Footer */}
      {assumptions.lastUpdated && (
        <div className="p-2 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 text-center">
            Last updated: {new Date(assumptions.lastUpdated).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}

export default AssumptionsPanel;
