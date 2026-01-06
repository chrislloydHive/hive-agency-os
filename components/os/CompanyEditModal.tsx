// components/os/CompanyEditModal.tsx
// Full company edit modal with all fields organized in sections

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CompanyRecord } from '@/lib/airtable/companies';

// ============================================================================
// Types
// ============================================================================

interface CompanyEditModalProps {
  company: CompanyRecord;
  onClose: () => void;
  onSave?: (company: CompanyRecord) => void;
}

// ============================================================================
// Constants
// ============================================================================

const COMPANY_TYPES = ['SaaS', 'Services', 'Marketplace', 'eCom', 'Local', 'Other'] as const;
const STAGES = ['Prospect', 'Client', 'Internal', 'Dormant', 'Lost'] as const;
const TIERS = ['A', 'B', 'C'] as const;
const SIZE_BANDS = ['1-10', '11-50', '51-200', '200+'] as const;
const SOURCES = ['Referral', 'Inbound', 'Outbound', 'Internal', 'Other', 'Full GAP', 'GAP IA', 'Manual Entry', 'DMA'] as const;
const ICP_FIT_SCORES = ['A', 'B', 'C'] as const;
const HEALTH_OVERRIDES = ['Healthy', 'At Risk'] as const;
const MEDIA_PROGRAM_STATUSES = ['none', 'active'] as const;
const MEDIA_LAB_STATUSES = ['none', 'planning', 'running', 'paused'] as const;
const MEDIA_OBJECTIVES = ['installs', 'leads', 'store_visits', 'calls', 'awareness'] as const;

// ============================================================================
// Section Components
// ============================================================================

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-800">
      {title}
    </h3>
  );
}

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: 'text' | 'email' | 'url';
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function TextAreaInput({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 resize-none"
    />
  );
}

function CheckboxInput({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/50"
      />
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

function TagsInput({
  tags,
  onAdd,
  onRemove,
  disabled,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) {
        onAdd(input.trim());
        setInput('');
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type and press Enter to add"
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => {
            if (input.trim()) {
              onAdd(input.trim());
              setInput('');
            }
          }}
          disabled={disabled || !input.trim()}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-300 text-sm rounded-lg"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(i)}
                disabled={disabled}
                className="text-emerald-400 hover:text-emerald-300 ml-1"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CompanyEditModal({ company, onClose, onSave }: CompanyEditModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identity Section
  const [name, setName] = useState(company.name || '');
  const [website, setWebsite] = useState(company.website || '');
  const [domain, setDomain] = useState(company.domain || '');

  // Classification Section
  const [industry, setIndustry] = useState(company.industry || '');
  const [companyType, setCompanyType] = useState(company.companyType || '');
  const [stage, setStage] = useState(company.stage || '');
  const [tier, setTier] = useState(company.tier || '');
  const [sizeBand, setSizeBand] = useState(company.sizeBand || '');
  const [region, setRegion] = useState(company.region || '');
  const [source, setSource] = useState(company.source || '');
  const [lifecycleStatus, setLifecycleStatus] = useState(company.lifecycleStatus || '');

  // Contact Section
  const [owner, setOwner] = useState(company.owner || '');
  const [primaryContactName, setPrimaryContactName] = useState(company.primaryContactName || '');
  const [primaryContactEmail, setPrimaryContactEmail] = useState(company.primaryContactEmail || '');
  const [primaryContactRole, setPrimaryContactRole] = useState(company.primaryContactRole || '');
  const [notes, setNotes] = useState(company.notes || '');
  const [internalNotes, setInternalNotes] = useState(company.internalNotes || '');
  const [tags, setTags] = useState<string[]>(company.tags || []);

  // ICP Section
  const [icpFitScore, setIcpFitScore] = useState(company.icpFitScore || '');

  // Analytics Section
  const [ga4PropertyId, setGa4PropertyId] = useState(company.ga4PropertyId || '');
  const [ga4Linked, setGa4Linked] = useState(company.ga4Linked || false);
  const [primaryConversionEvents, setPrimaryConversionEvents] = useState<string[]>(
    company.primaryConversionEvents || []
  );
  const [searchConsoleSiteUrl, setSearchConsoleSiteUrl] = useState(company.searchConsoleSiteUrl || '');

  // Health Section
  const [healthOverride, setHealthOverride] = useState(company.healthOverride || '');
  const [atRiskFlag, setAtRiskFlag] = useState(company.atRiskFlag || false);

  // Drive/Jobs Section
  const [driveEligible, setDriveEligible] = useState(company.driveEligible || false);
  const [driveProvisioningAllowed, setDriveProvisioningAllowed] = useState(
    company.driveProvisioningAllowed || false
  );
  const [clientCode, setClientCode] = useState(company.clientCode || '');

  // Media Section
  const [mediaProgramStatus, setMediaProgramStatus] = useState<string>(company.mediaProgramStatus || 'none');
  const [mediaLabStatus, setMediaLabStatus] = useState<string>(company.mediaLabStatus || 'none');
  const [mediaPrimaryObjective, setMediaPrimaryObjective] = useState<string>(company.mediaPrimaryObjective || '');
  const [mediaLabNotes, setMediaLabNotes] = useState(company.mediaLabNotes || '');

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Validation
  const validate = (): string | null => {
    if (!name.trim()) return 'Company name is required';
    if (primaryContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryContactEmail)) {
      return 'Invalid email format for primary contact';
    }
    if (clientCode && !/^[A-Z]{3}$/.test(clientCode)) {
      return 'Client code must be exactly 3 uppercase letters';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Identity
          name,
          website,
          domain,
          // Classification
          industry,
          companyType: companyType || undefined,
          stage: stage || undefined,
          tier: tier || undefined,
          sizeBand: sizeBand || undefined,
          region,
          source: source || undefined,
          lifecycleStatus,
          // Contact
          owner,
          primaryContactName,
          primaryContactEmail,
          primaryContactRole,
          notes,
          internalNotes,
          tags,
          // ICP
          icpFitScore: icpFitScore || undefined,
          // Analytics
          ga4PropertyId,
          ga4Linked,
          primaryConversionEvents,
          searchConsoleSiteUrl,
          // Health
          healthOverride: healthOverride || undefined,
          atRiskFlag,
          // Drive/Jobs
          driveEligible,
          driveProvisioningAllowed,
          clientCode,
          // Media
          mediaProgramStatus,
          mediaLabStatus,
          mediaPrimaryObjective: mediaPrimaryObjective || undefined,
          mediaLabNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Failed to update company');
      }

      // Refresh and close
      router.refresh();
      onSave?.(result.company);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Edit Company</h2>
              <p className="text-sm text-slate-400 mt-0.5">{company.name}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-300 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
            <div className="px-6 py-4 space-y-6">
              {/* Identity Section */}
              <section className="space-y-4">
                <SectionHeader title="Identity" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Company Name">
                    <TextInput
                      value={name}
                      onChange={setName}
                      placeholder="Acme Corp"
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Website">
                    <TextInput
                      value={website}
                      onChange={setWebsite}
                      placeholder="https://example.com"
                      type="url"
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
                <FormField label="Domain" hint="Normalized domain for deduplication">
                  <TextInput
                    value={domain}
                    onChange={setDomain}
                    placeholder="example.com"
                    disabled={isSubmitting}
                  />
                </FormField>
              </section>

              {/* Classification Section */}
              <section className="space-y-4">
                <SectionHeader title="Classification" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Industry">
                    <TextInput
                      value={industry}
                      onChange={setIndustry}
                      placeholder="e.g., Technology, Healthcare..."
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Company Type">
                    <SelectInput
                      value={companyType}
                      onChange={setCompanyType}
                      options={COMPANY_TYPES}
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Stage">
                    <SelectInput
                      value={stage}
                      onChange={setStage}
                      options={STAGES}
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Tier">
                    <SelectInput
                      value={tier}
                      onChange={setTier}
                      options={TIERS}
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Size Band">
                    <SelectInput
                      value={sizeBand}
                      onChange={setSizeBand}
                      options={SIZE_BANDS}
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Region">
                    <TextInput
                      value={region}
                      onChange={setRegion}
                      placeholder="e.g., US West, EMEA..."
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Source">
                    <SelectInput
                      value={source}
                      onChange={setSource}
                      options={SOURCES}
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Lifecycle Status">
                    <TextInput
                      value={lifecycleStatus}
                      onChange={setLifecycleStatus}
                      placeholder="e.g., Active, Onboarding..."
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
              </section>

              {/* Contact Section */}
              <section className="space-y-4">
                <SectionHeader title="Contact" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Owner">
                    <TextInput
                      value={owner}
                      onChange={setOwner}
                      placeholder="Account owner name"
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Primary Contact Name">
                    <TextInput
                      value={primaryContactName}
                      onChange={setPrimaryContactName}
                      placeholder="John Doe"
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Primary Contact Email">
                    <TextInput
                      value={primaryContactEmail}
                      onChange={setPrimaryContactEmail}
                      placeholder="john@example.com"
                      type="email"
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Primary Contact Role">
                    <TextInput
                      value={primaryContactRole}
                      onChange={setPrimaryContactRole}
                      placeholder="e.g., CEO, Marketing Director..."
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
                <FormField label="Notes">
                  <TextAreaInput
                    value={notes}
                    onChange={setNotes}
                    placeholder="Public notes about this company..."
                    disabled={isSubmitting}
                  />
                </FormField>
                <FormField label="Internal Notes">
                  <TextAreaInput
                    value={internalNotes}
                    onChange={setInternalNotes}
                    placeholder="Private internal notes..."
                    disabled={isSubmitting}
                  />
                </FormField>
                <FormField label="Tags">
                  <TagsInput
                    tags={tags}
                    onAdd={(tag) => setTags([...tags, tag])}
                    onRemove={(i) => setTags(tags.filter((_, idx) => idx !== i))}
                    disabled={isSubmitting}
                  />
                </FormField>
              </section>

              {/* ICP Section */}
              <section className="space-y-4">
                <SectionHeader title="ICP Fit" />
                <FormField label="ICP Fit Score">
                  <SelectInput
                    value={icpFitScore}
                    onChange={setIcpFitScore}
                    options={ICP_FIT_SCORES}
                    placeholder="Select score..."
                    disabled={isSubmitting}
                  />
                </FormField>
              </section>

              {/* Analytics Section */}
              <section className="space-y-4">
                <SectionHeader title="Analytics" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="GA4 Property ID">
                    <TextInput
                      value={ga4PropertyId}
                      onChange={setGa4PropertyId}
                      placeholder="e.g., 123456789"
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Search Console Site URL">
                    <TextInput
                      value={searchConsoleSiteUrl}
                      onChange={setSearchConsoleSiteUrl}
                      placeholder="https://example.com"
                      type="url"
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
                <CheckboxInput
                  checked={ga4Linked}
                  onChange={setGa4Linked}
                  label="GA4 Linked"
                  disabled={isSubmitting}
                />
                <FormField label="Primary Conversion Events">
                  <TagsInput
                    tags={primaryConversionEvents}
                    onAdd={(event) => setPrimaryConversionEvents([...primaryConversionEvents, event])}
                    onRemove={(i) =>
                      setPrimaryConversionEvents(primaryConversionEvents.filter((_, idx) => idx !== i))
                    }
                    disabled={isSubmitting}
                  />
                </FormField>
              </section>

              {/* Health Section */}
              <section className="space-y-4">
                <SectionHeader title="Health" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Health Override">
                    <SelectInput
                      value={healthOverride}
                      onChange={setHealthOverride}
                      options={HEALTH_OVERRIDES}
                      placeholder="No override"
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
                <CheckboxInput
                  checked={atRiskFlag}
                  onChange={setAtRiskFlag}
                  label="At Risk Flag"
                  disabled={isSubmitting}
                />
              </section>

              {/* Drive/Jobs Section */}
              <section className="space-y-4">
                <SectionHeader title="Drive / Jobs" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Client Code" hint="3 uppercase letters (e.g., ACM)">
                    <TextInput
                      value={clientCode}
                      onChange={(v) => setClientCode(v.toUpperCase())}
                      placeholder="ABC"
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
                <div className="space-y-2">
                  <CheckboxInput
                    checked={driveEligible}
                    onChange={setDriveEligible}
                    label="Drive Eligible"
                    disabled={isSubmitting}
                  />
                  <CheckboxInput
                    checked={driveProvisioningAllowed}
                    onChange={setDriveProvisioningAllowed}
                    label="Drive Provisioning Allowed"
                    disabled={isSubmitting}
                  />
                </div>
              </section>

              {/* Media Section */}
              <section className="space-y-4">
                <SectionHeader title="Media Program" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Media Program Status">
                    <SelectInput
                      value={mediaProgramStatus}
                      onChange={setMediaProgramStatus}
                      options={MEDIA_PROGRAM_STATUSES}
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Media Lab Status">
                    <SelectInput
                      value={mediaLabStatus}
                      onChange={setMediaLabStatus}
                      options={MEDIA_LAB_STATUSES}
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <FormField label="Media Primary Objective">
                    <SelectInput
                      value={mediaPrimaryObjective}
                      onChange={setMediaPrimaryObjective}
                      options={MEDIA_OBJECTIVES}
                      placeholder="Select objective..."
                      disabled={isSubmitting}
                    />
                  </FormField>
                </div>
                <FormField label="Media Lab Notes">
                  <TextAreaInput
                    value={mediaLabNotes}
                    onChange={setMediaLabNotes}
                    placeholder="Strategic notes for media planning..."
                    disabled={isSubmitting}
                  />
                </FormField>
              </section>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-sm text-red-300">
                  <span className="font-medium">Error:</span> {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
