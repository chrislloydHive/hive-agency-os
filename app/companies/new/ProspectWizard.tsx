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

type WizardStep = 1 | 2 | 'success';

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

const RELATIONSHIP_TYPES = [
  { value: 'Prospect', label: 'Prospect', description: 'Potential customer in sales pipeline' },
  { value: 'Client', label: 'Client', description: 'Active paying customer' },
  { value: 'Partner', label: 'Partner', description: 'Strategic partner or affiliate' },
  { value: 'Internal', label: 'Internal', description: 'Internal project or test company' },
  { value: 'Other', label: 'Other', description: 'Other relationship type' },
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
  const [relationshipType, setRelationshipType] = useState('Prospect');
  const [icpFitScore, setIcpFitScore] = useState('');
  const [owner, setOwner] = useState('');
  const [notes, setNotes] = useState('');

  // Additional Options (moved from Step 3)
  const [createOpportunity, setCreateOpportunity] = useState(false);

  // Success screen state
  const [createdCompany, setCreatedCompany] = useState<{ id: string; name: string } | null>(null);

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
    if (step === 1) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Create the company record only - NO intelligence pipelines
      // Intelligence (Labs + GAP) runs later via the Engagement flow
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
          // IMPORTANT: Do NOT run any diagnostics or pipelines here
          // Intelligence is triggered later via Engagement selection
          runGapSnapshot: false,
          runWebsiteLab: false,
          runInitialDiagnostics: false,
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

      // Go straight to success - no pipeline to run
      setStep('success');
      setIsSubmitting(false);
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
          <div className="flex items-center justify-center">
            {[1, 2].map((s) => (
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
                {s < 2 && (
                  <div
                    className={`w-32 h-0.5 mx-3 transition-colors ${
                      typeof step === 'number' && s < step ? 'bg-emerald-500/30' : 'bg-slate-800'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-32 mt-2">
            <span className={`text-xs ${step === 1 ? 'text-amber-400' : 'text-slate-500'}`}>
              Company Basics
            </span>
            <span className={`text-xs ${step === 2 ? 'text-amber-400' : 'text-slate-500'}`}>
              Classification
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
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Relationship Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIP_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setRelationshipType(type.value)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      relationshipType === type.value
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                        : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="text-sm font-medium">{type.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{type.description}</div>
                  </button>
                ))}
              </div>
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

            {/* Optional: Create Opportunity */}
            <div className="pt-4 border-t border-slate-700/50">
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
          </div>
        )}

        {/* Step 3 removed - Intelligence pipeline now runs via Engagement flow */}

        {/* Success Screen */}
        {step === 'success' && createdCompany && (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-100">Company Created</h2>
              <p className="text-sm text-slate-400 mt-2">
                {createdCompany.name} has been added to the OS.
              </p>
              <p className="text-xs text-slate-500 mt-1">Type: {relationshipType}</p>
            </div>

            {/* What's Next - Guide to Engagement Flow */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-300">Next: Choose your path</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Visit the company overview to select an engagement type and start gathering context.
                    Intelligence runs after you tell us what you're trying to do.
                  </p>
                </div>
              </div>
            </div>
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
                setRelationshipType('Prospect');
                setIcpFitScore('');
                setOwner('');
                setNotes('');
                setCreateOpportunity(false);
                setCreatedCompany(null);
                setGapData(null);
                setExistingCompanyId(null);
                setExistingCompanyName(null);
              }}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              + Create Another
            </Link>
          ) : step === 2 ? (
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
          {step === 'success' && createdCompany ? (
            <Link
              href={`/c/${createdCompany.id}`}
              className="px-6 py-2 bg-emerald-500 text-slate-900 font-medium rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Go to Company Overview →
            </Link>
          ) : step === 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceedStep1}
              className="px-6 py-2 bg-amber-500 text-slate-900 font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          ) : step === 2 ? (
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
                'Create Company'
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
