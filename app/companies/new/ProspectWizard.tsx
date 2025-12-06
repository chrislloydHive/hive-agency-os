'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { extractDomain, domainToDisplayName, isValidDomain } from '@/lib/utils/extractDomain';
import type { GapLookupResult } from '@/app/api/gap/lookup/route';

interface TeamMember {
  id: string;
  name: string;
  specialty: string;
}

interface ProspectWizardProps {
  teamMembers: TeamMember[];
}

type WizardStep = 1 | 2 | 3 | 'success';

const INDUSTRIES = [
  'SaaS',
  'Technology',
  'Services',
  'Consulting',
  'Agency',
  'E-commerce',
  'Retail',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Real Estate',
  'Education',
  'Non-profit',
  'Other',
];

const COMPANY_TYPES = [
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Services', label: 'Services' },
  { value: 'Marketplace', label: 'Marketplace' },
  { value: 'eCom', label: 'E-commerce' },
  { value: 'Local', label: 'Local Business' },
  { value: 'Other', label: 'Other' },
];

const SIZE_BANDS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '200+', label: '200+ employees' },
];

const ICP_FIT_SCORES = [
  { value: 'A', label: 'A - Ideal Fit' },
  { value: 'B', label: 'B - Good Fit' },
  { value: 'C', label: 'C - Low Fit' },
];

export function ProspectWizard({ teamMembers }: ProspectWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 - Company Basics
  const [companyName, setCompanyName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [industry, setIndustry] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [sizeBand, setSizeBand] = useState('');

  // Step 2 - Classification
  const [icpFitScore, setIcpFitScore] = useState('');
  const [owner, setOwner] = useState('');
  const [notes, setNotes] = useState('');

  // Step 3 - Actions
  const [createOpportunity, setCreateOpportunity] = useState(false);
  const [runIntelligencePipeline, setRunIntelligencePipeline] = useState(true);

  // Success screen state
  const [createdCompany, setCreatedCompany] = useState<{ id: string; name: string } | null>(null);
  const [pipelineResult, setPipelineResult] = useState<{
    success: boolean;
    snapshotId?: string;
    contextHealthAfter?: { score: number; severity: string };
    error?: string;
  } | null>(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

  // GAP lookup state
  const [isLookingUpGap, setIsLookingUpGap] = useState(false);
  const [gapData, setGapData] = useState<GapLookupResult['data'] | null>(null);
  const [existingCompanyId, setExistingCompanyId] = useState<string | null>(null);
  const [existingCompanyName, setExistingCompanyName] = useState<string | null>(null);
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lookup GAP data by URL
  const lookupGapData = useCallback(async (url: string) => {
    const domain = extractDomain(url);
    if (!domain || !isValidDomain(domain)) return;

    setIsLookingUpGap(true);
    try {
      const response = await fetch(`/api/gap/lookup?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        setGapData(null);
        return;
      }

      const result: GapLookupResult = await response.json();

      if (result.found && result.data) {
        setGapData(result.data);

        // Auto-fill form fields from GAP data
        if (result.data.companyName && !companyName) {
          setCompanyName(result.data.companyName);
        }
        if (result.data.companyType && !companyType) {
          // Map GAP company types to our form values
          const typeMap: Record<string, string> = {
            'saas': 'SaaS',
            'services': 'Services',
            'marketplace': 'Marketplace',
            'ecommerce': 'eCom',
            'e-commerce': 'eCom',
            'local': 'Local',
            'local_service': 'Local',
          };
          const mappedType = typeMap[result.data.companyType.toLowerCase()] || result.data.companyType;
          if (COMPANY_TYPES.some(t => t.value === mappedType)) {
            setCompanyType(mappedType);
          }
        }

        // If already linked to a company, store the ID
        if (result.data.existingCompanyId) {
          setExistingCompanyId(result.data.existingCompanyId);
        }

        // If GAP data exists, still recommend running the full pipeline
        // as it provides more comprehensive context than just GAP
      } else {
        setGapData(null);
        setExistingCompanyId(null);
      }
    } catch (err) {
      console.error('GAP lookup failed:', err);
      setGapData(null);
    } finally {
      setIsLookingUpGap(false);
    }
  }, [companyName, companyType]);

  // Auto-extract domain, suggest company name, and lookup GAP data
  const handleWebsiteChange = (url: string) => {
    setWebsiteUrl(url);
    setGapData(null);
    setExistingCompanyId(null);

    // Clear previous timeout
    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    const domain = extractDomain(url);
    if (domain && isValidDomain(domain)) {
      // Set fallback name from domain if no name yet
      if (!companyName) {
        const suggestedName = domainToDisplayName(domain);
        if (suggestedName) {
          setCompanyName(suggestedName);
        }
      }

      // Debounce GAP lookup
      lookupTimeoutRef.current = setTimeout(() => {
        lookupGapData(url);
      }, 500);
    }
  };

  const canProceedStep1 = companyName.trim().length > 0;
  const canProceedStep2 = true; // All fields optional
  const canSubmit = canProceedStep1;

  const handleNext = () => {
    if (typeof step === 'number' && step < 3) {
      setStep((step + 1) as WizardStep);
    }
  };

  const handleBack = () => {
    if (typeof step === 'number' && step > 1) {
      setStep((step - 1) as WizardStep);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the prospect
      const response = await fetch('/api/prospects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName.trim(),
          website: websiteUrl.trim() || undefined,
          industry: industry || undefined,
          companyType: companyType || undefined,
          sizeBand: sizeBand || undefined,
          icpFitScore: icpFitScore || undefined,
          owner: owner || undefined,
          notes: notes.trim() || undefined,
          createOpportunity,
          // Don't run old diagnostics - we'll use the new pipeline
          runGapSnapshot: false,
          runWebsiteLab: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();

        // Handle "company already exists" case specially
        if (response.status === 409 && data.existingCompanyId) {
          setExistingCompanyId(data.existingCompanyId);
          setExistingCompanyName(data.existingCompanyName || 'this domain');
          setError(null); // Clear generic error, we'll show a special UI
          setIsSubmitting(false);
          return;
        }

        throw new Error(data.error || 'Failed to create prospect');
      }

      const data = await response.json();
      const newCompany = { id: data.company.id, name: data.company.name };
      setCreatedCompany(newCompany);

      // If Intelligence Pipeline is enabled and we have a website, run it
      if (runIntelligencePipeline && websiteUrl.trim()) {
        setIsPipelineRunning(true);
        setStep('success');
        setIsSubmitting(false);

        try {
          const pipelineResponse = await fetch(
            `/api/os/companies/${newCompany.id}/onboarding/run-all`,
            { method: 'POST' }
          );

          const pipelineData = await pipelineResponse.json();

          if (pipelineResponse.ok && pipelineData.success) {
            setPipelineResult({
              success: true,
              snapshotId: pipelineData.snapshotId,
              contextHealthAfter: pipelineData.contextHealthAfter,
            });
          } else {
            setPipelineResult({
              success: false,
              error: pipelineData.error || 'Pipeline completed with issues',
            });
          }
        } catch (pipelineErr) {
          console.error('Pipeline failed:', pipelineErr);
          setPipelineResult({
            success: false,
            error: pipelineErr instanceof Error ? pipelineErr.message : 'Pipeline failed',
          });
        } finally {
          setIsPipelineRunning(false);
        }
      } else {
        // No pipeline - go straight to success
        setStep('success');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Failed to create prospect:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Progress indicator - hide on success */}
      {step !== 'success' && (
        <div className="border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    s === step
                      ? 'bg-amber-500 text-slate-900'
                      : typeof step === 'number' && s < step
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {typeof step === 'number' && s < step ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    s
                  )}
                </div>
                {s < 3 && (
                  <div
                    className={`w-24 h-0.5 mx-2 transition-colors ${
                      typeof step === 'number' && s < step ? 'bg-emerald-500/30' : 'bg-slate-800'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className={`text-xs ${step === 1 ? 'text-amber-400' : 'text-slate-500'}`}>
              Company Basics
            </span>
            <span className={`text-xs ${step === 2 ? 'text-amber-400' : 'text-slate-500'}`}>
              Classification
            </span>
            <span className={`text-xs ${step === 3 ? 'text-amber-400' : 'text-slate-500'}`}>
              Actions
            </span>
          </div>
        </div>
      )}

      {/* Form content */}
      <div className="p-6">
        {/* Company already exists - show helpful UI */}
        {existingCompanyId && !error && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-medium">
                  Company Already Exists
                </p>
                <p className="text-xs text-amber-400/80 mt-1">
                  A company record for <span className="font-medium">{existingCompanyName}</span> already exists in the database.
                </p>
                <div className="flex gap-3 mt-3">
                  <Link
                    href={`/c/${existingCompanyId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-medium rounded-lg transition-colors"
                  >
                    View Company
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => {
                      setExistingCompanyId(null);
                      setExistingCompanyName(null);
                      setWebsiteUrl('');
                      setCompanyName('');
                      setGapData(null);
                    }}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Try Different URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generic error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Company Basics */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Website URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => handleWebsiteChange(e.target.value)}
                  placeholder="https://acme.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                />
                {isLookingUpGap && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="w-4 h-4 animate-spin text-slate-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}
              </div>
              {websiteUrl && !gapData && !isLookingUpGap && (
                <p className="mt-1 text-xs text-slate-500">
                  Domain: {extractDomain(websiteUrl) || '—'}
                </p>
              )}

              {/* GAP Data Found Indicator */}
              {gapData && (
                <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-emerald-300 font-medium">
                        GAP data found
                      </p>
                      <p className="text-xs text-emerald-400/80 mt-0.5">
                        {gapData.companyName && `Company: ${gapData.companyName}`}
                        {gapData.overallScore != null && gapData.overallScore > 0 && ` • Score: ${gapData.overallScore}`}
                        {gapData.maturityStage && ` • ${gapData.maturityStage}`}
                      </p>
                      {existingCompanyId && (
                        <p className="text-xs text-amber-400 mt-1">
                          This company already exists in the OS.{' '}
                          <Link href={`/c/${existingCompanyId}`} className="underline hover:text-amber-300">
                            View company →
                          </Link>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Industry
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                >
                  <option value="">Select...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Company Type
                </label>
                <select
                  value={companyType}
                  onChange={(e) => setCompanyType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
                >
                  <option value="">Select...</option>
                  {COMPANY_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Size Band
              </label>
              <select
                value={sizeBand}
                onChange={(e) => setSizeBand(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              >
                <option value="">Select...</option>
                {SIZE_BANDS.map((band) => (
                  <option key={band.value} value={band.value}>
                    {band.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Classification */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Stage:</strong> Prospect (default)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                ICP Fit Score
              </label>
              <select
                value={icpFitScore}
                onChange={(e) => setIcpFitScore(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              >
                <option value="">Select...</option>
                {ICP_FIT_SCORES.map((score) => (
                  <option key={score.value} value={score.value}>
                    {score.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Owner (Rep)
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name} ({member.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any additional context about this prospect..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 3: Actions */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 mb-4">
              Select which actions to run after creating the prospect:
            </p>

            {/* Intelligence Actions Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Intelligence Actions
              </h4>

              <label className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors ${
                runIntelligencePipeline && websiteUrl
                  ? 'bg-emerald-500/10 border-2 border-emerald-500/40'
                  : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-800/70'
              } ${!websiteUrl ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={runIntelligencePipeline}
                  onChange={(e) => setRunIntelligencePipeline(e.target.checked)}
                  disabled={!websiteUrl}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/50 disabled:opacity-50"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 font-medium">
                      Run Intelligence Initialization Pipeline
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Automatically runs FCB, Labs Refinement, and Full GAP Orchestrator to initialize the company's context and insights.
                  </p>
                  {websiteUrl && runIntelligencePipeline && (
                    <div className="mt-3 p-2 bg-slate-800/50 rounded-lg">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Pipeline Steps:</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded">FCB</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded">Audience Lab</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded">Brand Lab</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-[10px] px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded">Creative Lab</span>
                        <span className="text-slate-600">→</span>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">Full GAP</span>
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {!websiteUrl && (
                <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Add a website URL in Step 1 to enable the Intelligence Pipeline
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-700/50 my-4" />

            {/* Sales Actions Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Sales Actions
              </h4>

              <label className="flex items-start gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/70 transition-colors">
                <input
                  type="checkbox"
                  checked={createOpportunity}
                  onChange={(e) => setCreateOpportunity(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500/50"
                />
                <div>
                  <span className="text-slate-200 font-medium">Create Opportunity</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add to sales pipeline with Discovery stage
                  </p>
                </div>
              </label>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-300 mb-2">Summary</h3>
              <dl className="text-sm space-y-1">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Company</dt>
                  <dd className="text-slate-200">{companyName || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Website</dt>
                  <dd className="text-slate-200">{extractDomain(websiteUrl) || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Stage</dt>
                  <dd className="text-blue-400">Prospect</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Owner</dt>
                  <dd className="text-slate-200">{owner || 'Unassigned'}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Success Screen */}
        {step === 'success' && createdCompany && (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="text-center">
              {isPipelineRunning ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-400 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-100">Initializing {createdCompany.name}...</h2>
                  <p className="text-sm text-slate-400 mt-2">
                    Running Intelligence Pipeline: FCB → Labs → GAP Orchestrator
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded animate-pulse">Processing...</span>
                  </div>
                </>
              ) : pipelineResult?.success ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-100">Prospect Created & Initialized</h2>
                  <p className="text-sm text-slate-400 mt-2">
                    {createdCompany.name} has been added to the OS with full context.
                  </p>
                  {pipelineResult.contextHealthAfter && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
                      <span className="text-xs text-slate-400">Context Health:</span>
                      <span className={`text-sm font-medium ${
                        pipelineResult.contextHealthAfter.score >= 70 ? 'text-emerald-400' :
                        pipelineResult.contextHealthAfter.score >= 50 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {pipelineResult.contextHealthAfter.score}%
                      </span>
                    </div>
                  )}
                </>
              ) : pipelineResult?.error ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-100">Prospect Created</h2>
                  <p className="text-sm text-amber-400 mt-2">
                    Initialization pipeline partially completed — review context for missing fields.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-100">Prospect Created</h2>
                  <p className="text-sm text-slate-400 mt-2">
                    {createdCompany.name} has been added to the OS.
                  </p>
                </>
              )}
            </div>

            {/* Next Steps */}
            {!isPipelineRunning && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                  Next Steps
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href={`/c/${createdCompany.id}/brain/context`}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 hover:border-slate-600 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">View Context Graph</p>
                      <p className="text-xs text-slate-500">Review company context</p>
                    </div>
                  </Link>

                  <Link
                    href={`/c/${createdCompany.id}/brain/insights`}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 hover:border-slate-600 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">View Insights</p>
                      <p className="text-xs text-slate-500">AI-generated insights</p>
                    </div>
                  </Link>

                  <Link
                    href={`/c/${createdCompany.id}/gap`}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 hover:border-slate-600 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">View GAP Run</p>
                      <p className="text-xs text-slate-500">Marketing diagnostics</p>
                    </div>
                  </Link>

                  <Link
                    href={`/c/${createdCompany.id}/labs/qbr`}
                    className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 hover:border-slate-600 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Start QBR</p>
                      <p className="text-xs text-slate-500">Quarterly review</p>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="border-t border-slate-800 p-4 flex items-center justify-between">
        <div>
          {step === 'success' ? (
            <Link
              href="/companies/new"
              onClick={(e) => {
                e.preventDefault();
                // Reset form state
                setStep(1);
                setCompanyName('');
                setWebsiteUrl('');
                setIndustry('');
                setCompanyType('');
                setSizeBand('');
                setIcpFitScore('');
                setOwner('');
                setNotes('');
                setCreateOpportunity(false);
                setRunIntelligencePipeline(true);
                setCreatedCompany(null);
                setPipelineResult(null);
                setGapData(null);
                setExistingCompanyId(null);
                setExistingCompanyName(null);
              }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              + Create Another
            </Link>
          ) : step === 2 || step === 3 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <Link
              href="/companies"
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </Link>
          )}
        </div>

        <div>
          {step === 'success' && createdCompany && !isPipelineRunning ? (
            <Link
              href={`/c/${createdCompany.id}`}
              className="px-6 py-2 bg-emerald-500 text-slate-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Go to Company Overview →
            </Link>
          ) : step === 1 || step === 2 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && !canProceedStep1}
              className="px-6 py-2 bg-amber-500 text-slate-900 font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          ) : step === 3 ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-6 py-2 bg-emerald-500 text-slate-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Prospect'
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
