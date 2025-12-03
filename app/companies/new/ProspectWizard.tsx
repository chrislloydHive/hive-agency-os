'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { extractDomain, domainToDisplayName, isValidDomain } from '@/lib/utils/extractDomain';

interface TeamMember {
  id: string;
  name: string;
  specialty: string;
}

interface ProspectWizardProps {
  teamMembers: TeamMember[];
}

type WizardStep = 1 | 2 | 3;

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
  { value: '1–10', label: '1-10 employees' },
  { value: '11–50', label: '11-50 employees' },
  { value: '51–200', label: '51-200 employees' },
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
  const [runGapSnapshot, setRunGapSnapshot] = useState(true);
  const [runWebsiteLab, setRunWebsiteLab] = useState(false);

  // Auto-extract domain and suggest company name
  const handleWebsiteChange = (url: string) => {
    setWebsiteUrl(url);

    if (url && !companyName) {
      const domain = extractDomain(url);
      if (isValidDomain(domain)) {
        const suggestedName = domainToDisplayName(domain);
        if (suggestedName) {
          setCompanyName(suggestedName);
        }
      }
    }
  };

  const canProceedStep1 = companyName.trim().length > 0;
  const canProceedStep2 = true; // All fields optional
  const canSubmit = canProceedStep1;

  const handleNext = () => {
    if (step < 3) {
      setStep((step + 1) as WizardStep);
    }
  };

  const handleBack = () => {
    if (step > 1) {
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
          runGapSnapshot,
          runWebsiteLab,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create prospect');
      }

      const data = await response.json();

      // Redirect to the new company page
      router.push(`/c/${data.company.id}`);
    } catch (err) {
      console.error('Failed to create prospect:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Progress indicator */}
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  s === step
                    ? 'bg-amber-500 text-slate-900'
                    : s < step
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {s < step ? (
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
                    s < step ? 'bg-emerald-500/30' : 'bg-slate-800'
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

      {/* Form content */}
      <div className="p-6">
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
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => handleWebsiteChange(e.target.value)}
                placeholder="https://acme.com"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              />
              {websiteUrl && (
                <p className="mt-1 text-xs text-slate-500">
                  Domain: {extractDomain(websiteUrl) || '—'}
                </p>
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

            <label className="flex items-start gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/70 transition-colors">
              <input
                type="checkbox"
                checked={runGapSnapshot}
                onChange={(e) => setRunGapSnapshot(e.target.checked)}
                disabled={!websiteUrl}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500/50 disabled:opacity-50"
              />
              <div className={!websiteUrl ? 'opacity-50' : ''}>
                <span className="text-slate-200 font-medium">Run GAP Snapshot</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Quick marketing assessment (requires website)
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/70 transition-colors">
              <input
                type="checkbox"
                checked={runWebsiteLab}
                onChange={(e) => setRunWebsiteLab(e.target.checked)}
                disabled={!websiteUrl}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500/50 disabled:opacity-50"
              />
              <div className={!websiteUrl ? 'opacity-50' : ''}>
                <span className="text-slate-200 font-medium">Run Website Lab</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Website performance analysis (requires website)
                </p>
              </div>
            </label>

            {!websiteUrl && (
              <p className="text-xs text-amber-400/80">
                Add a website URL in Step 1 to enable diagnostic tools
              </p>
            )}

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
      </div>

      {/* Footer buttons */}
      <div className="border-t border-slate-800 p-4 flex items-center justify-between">
        <div>
          {step > 1 ? (
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
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={step === 1 && !canProceedStep1}
              className="px-6 py-2 bg-amber-500 text-slate-900 font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
