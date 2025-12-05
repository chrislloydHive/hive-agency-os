'use client';

// app/c/[companyId]/setup/StepCreativeStrategy.tsx
// Step 8: Creative Strategy

import { SetupFormData } from './types';
import { FormSection, FormField, TagInput, LabLink, inputStyles } from './components/StepContainer';

interface StepCreativeStrategyProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

const FORMAT_OPTIONS = [
  { id: 'static_image', label: 'Static Images', icon: '🖼️' },
  { id: 'carousel', label: 'Carousel', icon: '📸' },
  { id: 'video_short', label: 'Short Video (<30s)', icon: '🎬' },
  { id: 'video_long', label: 'Long Video (>30s)', icon: '📹' },
  { id: 'html5', label: 'HTML5/Animated', icon: '✨' },
  { id: 'responsive_display', label: 'Responsive Display', icon: '📱' },
  { id: 'text_ad', label: 'Text Ads', icon: '📝' },
  { id: 'native', label: 'Native Content', icon: '📰' },
  { id: 'audio', label: 'Audio/Podcast', icon: '🎧' },
  { id: 'ugc', label: 'UGC Content', icon: '🤳' },
];

const MESSAGE_SUGGESTIONS = [
  'Save time and money',
  'Trusted by industry leaders',
  'Results guaranteed',
  'Expert solutions',
  'Award-winning service',
  'Free consultation',
  'Limited time offer',
  'Industry best rates',
];

const PROOF_POINT_SUGGESTIONS = [
  'Customer testimonials',
  'Case studies',
  'Industry awards',
  'Years in business',
  'Customers served',
  'Money saved',
  'Satisfaction guarantee',
  'Certifications',
  'Media mentions',
];

const CTA_SUGGESTIONS = [
  'Get Started',
  'Request Quote',
  'Book Demo',
  'Learn More',
  'Contact Us',
  'Start Free Trial',
  'Schedule Call',
  'Download Guide',
  'Shop Now',
  'Get Pricing',
];

export function StepCreativeStrategy({
  companyId,
  formData,
  updateStepData,
}: StepCreativeStrategyProps) {
  const data = formData.creativeStrategy || {
    coreMessages: [],
    proofPoints: [],
    callToActions: [],
    availableFormats: [],
    brandGuidelines: '',
  };

  const update = (changes: Partial<typeof data>) => {
    updateStepData('creativeStrategy', changes);
  };

  const toggleFormat = (formatId: string) => {
    const current = data.availableFormats || [];
    if (current.includes(formatId)) {
      update({ availableFormats: current.filter((f) => f !== formatId) });
    } else {
      update({ availableFormats: [...current, formatId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Lab Integration Banner */}
      <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="font-medium text-pink-300">Full Creative Workshop</div>
          <div className="text-sm text-pink-400/80 mt-0.5">
            Generate ad concepts and messaging with AI in Creative Lab
          </div>
        </div>
        <LabLink companyId={companyId} lab="creative" label="Open Creative Lab" />
      </div>

      {/* Core Messages */}
      <FormSection
        title="Core Messaging"
        description="Key messages that resonate with your audience"
      >
        <FormField
          label="Core Messages"
          required
          hint="Primary value propositions and benefits"
        >
          <TagInput
            value={data.coreMessages}
            onChange={(tags) => update({ coreMessages: tags })}
            placeholder="Add core messages..."
            suggestions={MESSAGE_SUGGESTIONS}
          />
        </FormField>
      </FormSection>

      {/* Proof Points & CTAs */}
      <FormSection
        title="Trust & Action"
        description="Build credibility and drive action"
      >
        <div className="grid grid-cols-2 gap-6">
          <FormField
            label="Proof Points"
            hint="Evidence that supports your claims"
          >
            <TagInput
              value={data.proofPoints}
              onChange={(tags) => update({ proofPoints: tags })}
              placeholder="Add proof points..."
              suggestions={PROOF_POINT_SUGGESTIONS}
            />
          </FormField>

          <FormField
            label="Call to Actions"
            hint="CTAs that drive conversions"
          >
            <TagInput
              value={data.callToActions}
              onChange={(tags) => update({ callToActions: tags })}
              placeholder="Add CTAs..."
              suggestions={CTA_SUGGESTIONS}
            />
          </FormField>
        </div>
      </FormSection>

      {/* Available Formats */}
      <FormSection
        title="Creative Formats"
        description="What formats can you produce or source?"
      >
        <div className="grid grid-cols-5 gap-3">
          {FORMAT_OPTIONS.map((format) => {
            const isActive = (data.availableFormats || []).includes(format.id);
            return (
              <button
                key={format.id}
                type="button"
                onClick={() => toggleFormat(format.id)}
                className={`text-center p-3 rounded-lg border transition-all ${
                  isActive
                    ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="text-2xl mb-1">{format.icon}</div>
                <div className={`text-xs font-medium ${isActive ? 'text-purple-300' : 'text-slate-400'}`}>
                  {format.label}
                </div>
              </button>
            );
          })}
        </div>
      </FormSection>

      {/* Brand Guidelines */}
      <FormSection
        title="Brand Guidelines"
        description="Visual and messaging constraints"
      >
        <FormField
          label="Brand Guidelines Summary"
          hint="Key brand rules, colors, fonts, tone of voice"
        >
          <textarea
            value={data.brandGuidelines}
            onChange={(e) => update({ brandGuidelines: e.target.value })}
            className={inputStyles.textarea}
            rows={4}
            placeholder="e.g., 'Primary colors: #1E40AF (blue), #F59E0B (gold). Tone: Professional but approachable. Always use registered trademark on first mention. Avoid competitor names in ads.'"
          />
        </FormField>
      </FormSection>

      {/* Preview */}
      {(data.coreMessages.length > 0 || data.proofPoints.length > 0) && (
        <FormSection
          title="Messaging Preview"
          description="How your messaging elements come together"
        >
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div className="space-y-4">
              {data.coreMessages.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Headlines
                  </div>
                  <div className="space-y-1">
                    {data.coreMessages.slice(0, 3).map((msg, i) => (
                      <div key={i} className="text-slate-200 font-medium">
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.proofPoints.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    Supporting Evidence
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.proofPoints.map((point, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-sm"
                      >
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.callToActions.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                    CTAs
                  </div>
                  <div className="flex gap-2">
                    {data.callToActions.slice(0, 3).map((cta, i) => (
                      <button
                        key={i}
                        type="button"
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium"
                      >
                        {cta}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </FormSection>
      )}
    </div>
  );
}
