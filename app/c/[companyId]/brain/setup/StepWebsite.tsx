'use client';

// app/c/[companyId]/setup/StepWebsite.tsx
// Step 5: Website & Conversion Baseline

import { SetupFormData } from './types';
import { FormSection, FormField, TagInput, LabLink, inputStyles } from './components/StepContainer';

interface StepWebsiteProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

const CONVERSION_BLOCK_SUGGESTIONS = [
  'Slow page load times',
  'Poor mobile experience',
  'Confusing navigation',
  'Weak CTAs',
  'Too many form fields',
  'No trust signals',
  'Unclear value proposition',
  'Complex checkout process',
  'Missing contact options',
  'Broken links',
];

const OPPORTUNITY_SUGGESTIONS = [
  'Add social proof',
  'Simplify forms',
  'Improve page speed',
  'Add live chat',
  'Better mobile optimization',
  'Clearer pricing',
  'Add testimonials',
  'Improve CTAs',
  'A/B test landing pages',
  'Add exit intent popups',
];

const ISSUE_SEVERITY = [
  { value: 'critical', label: 'Critical', color: 'text-red-400 bg-red-400/10 border-red-400/30' },
  { value: 'high', label: 'High', color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  { value: 'low', label: 'Low', color: 'text-slate-400 bg-slate-400/10 border-slate-400/30' },
];

export function StepWebsite({
  companyId,
  formData,
  updateStepData,
}: StepWebsiteProps) {
  const data = formData.website || {
    websiteSummary: '',
    conversionBlocks: [],
    conversionOpportunities: [],
    criticalIssues: [],
    quickWins: [],
  };

  const update = (changes: Partial<typeof data>) => {
    updateStepData('website', changes);
  };

  return (
    <div className="space-y-6">
      {/* Lab Integration Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="font-medium text-amber-300">Run Website Diagnostic</div>
          <div className="text-sm text-amber-400/80 mt-0.5">
            Get a comprehensive audit with actionable recommendations
          </div>
        </div>
        <LabLink companyId={companyId} lab="website" label="Open Website Lab" />
      </div>

      {/* Website Overview */}
      <FormSection
        title="Website Overview"
        description="Summarize the current state of your website"
      >
        <FormField
          label="Website Summary"
          hint="Brief overview of website health and effectiveness"
        >
          <textarea
            value={data.websiteSummary}
            onChange={(e) => update({ websiteSummary: e.target.value })}
            className={inputStyles.textarea}
            rows={3}
            placeholder="e.g., 'Modern WordPress site with good mobile responsiveness. Main issues are page speed on product pages and unclear CTAs on the homepage. Conversion rate is currently 2.1%.'"
          />
        </FormField>
      </FormSection>

      {/* Conversion Issues */}
      <FormSection
        title="Conversion Blockers"
        description="What's preventing visitors from converting?"
      >
        <FormField
          label="Conversion Blocks"
          hint="Issues that negatively impact conversion rates"
        >
          <TagInput
            value={data.conversionBlocks}
            onChange={(tags) => update({ conversionBlocks: tags })}
            placeholder="Add conversion blockers..."
            suggestions={CONVERSION_BLOCK_SUGGESTIONS}
          />
        </FormField>

        <FormField
          label="Critical Issues"
          hint="Must-fix issues that are seriously impacting performance"
        >
          <TagInput
            value={data.criticalIssues}
            onChange={(tags) => update({ criticalIssues: tags })}
            placeholder="Add critical issues..."
            suggestions={['Core Web Vitals failing', 'SSL errors', 'Broken forms', 'Mobile not usable']}
          />
        </FormField>
      </FormSection>

      {/* Opportunities */}
      <FormSection
        title="Opportunities"
        description="Where can you improve?"
      >
        <FormField
          label="Conversion Opportunities"
          hint="Areas where you can boost conversion rates"
        >
          <TagInput
            value={data.conversionOpportunities}
            onChange={(tags) => update({ conversionOpportunities: tags })}
            placeholder="Add opportunities..."
            suggestions={OPPORTUNITY_SUGGESTIONS}
          />
        </FormField>

        <FormField
          label="Quick Wins"
          hint="Low-effort, high-impact improvements you can make quickly"
        >
          <TagInput
            value={data.quickWins}
            onChange={(tags) => update({ quickWins: tags })}
            placeholder="Add quick wins..."
            suggestions={['Add trust badges', 'Fix broken links', 'Update outdated content', 'Add phone number to header']}
          />
        </FormField>
      </FormSection>

      {/* Import from Lab */}
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-slate-700 rounded-lg">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-slate-200">Import from Website Lab</h4>
            <p className="text-sm text-slate-400 mt-1">
              If you've run a Website Lab diagnostic, you can import the findings directly.
            </p>
            <button
              type="button"
              className="mt-3 text-sm text-purple-400 hover:text-purple-300 font-medium"
            >
              Import Website Lab Results →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
