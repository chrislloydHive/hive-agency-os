'use client';

// components/mediaLab/CreativeLabWizard.tsx
// Creative Lab - AI Creative & Messaging Generator
//
// Steps:
// 1. Brief - Define campaign context, objective, and audience
// 2. Channels - Select channels and creative formats
// 3. Generate - AI generates creative concepts and copy
// 4. Review - Review, edit, and export creative package

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { type MediaChannel, CHANNEL_LABELS } from '@/lib/media/types';
import type {
  CreativeLabInput,
  CreativePackage,
  CreativeObjective,
  CreativeFormat,
  AdCopySet,
  ChannelCreative,
} from '@/lib/media/creativeLab';

// ============================================================================
// Types
// ============================================================================

type CreativeStep = 'brief' | 'channels' | 'generate' | 'review';

interface CreativeLabWizardProps {
  companyId: string;
  companyName: string;
  onClose?: () => void;
}

interface BriefFormData {
  objective: CreativeObjective;
  targetAudience: string;
  promotionContext: string;
  brandVoice: string;
  competitorDifferentiators: string[];
}

// ============================================================================
// Constants
// ============================================================================

const CREATIVE_OBJECTIVES: Array<{
  value: CreativeObjective;
  label: string;
  description: string;
}> = [
  { value: 'awareness', label: 'Brand Awareness', description: 'Introduce your brand to new audiences' },
  { value: 'consideration', label: 'Consideration', description: 'Drive interest and engagement' },
  { value: 'conversion', label: 'Conversion', description: 'Drive form fills, calls, and inquiries' },
  { value: 'retention', label: 'Customer Retention', description: 'Re-engage existing customers' },
  { value: 'seasonal_push', label: 'Seasonal Campaign', description: 'Time-sensitive seasonal messaging' },
];

const BRAND_VOICE_OPTIONS = [
  'Professional & Trustworthy',
  'Friendly & Approachable',
  'Bold & Confident',
  'Expert & Authoritative',
  'Fun & Playful',
  'Warm & Personal',
];

const CHANNEL_CREATIVE_FORMATS: Partial<Record<MediaChannel, CreativeFormat[]>> = {
  search: ['search_ad'],
  lsa: ['search_ad'],
  maps: ['search_ad'],
  social: ['social_post', 'video_script'],
  display: ['display_banner'],
  youtube: ['video_script'],
  radio: ['radio_script'],
  email: ['email'],
  tv: ['video_script'],
  streaming_audio: ['radio_script'],
  microsoft_search: ['search_ad'],
  tiktok: ['video_script', 'social_post'],
  affiliate: ['landing_page'],
  out_of_home: ['display_banner'],
  print: ['display_banner'],
  direct_mail: ['landing_page'],
};

// ============================================================================
// Step Indicator
// ============================================================================

function StepIndicator({ currentStep }: { currentStep: CreativeStep }) {
  const steps: Array<{ key: CreativeStep; label: string }> = [
    { key: 'brief', label: 'Creative Brief' },
    { key: 'channels', label: 'Channels' },
    { key: 'generate', label: 'Generate' },
    { key: 'review', label: 'Review' },
  ];

  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              index === currentIndex
                ? 'bg-purple-500 text-white'
                : index < currentIndex
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800/50 text-slate-500 border border-slate-700'
            }`}
          >
            {index < currentIndex ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span>{index + 1}</span>
            )}
            <span>{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-8 h-px mx-2 ${index < currentIndex ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Step 1: Brief
// ============================================================================

function BriefStep({
  data,
  onChange,
  onNext,
}: {
  data: BriefFormData;
  onChange: (data: BriefFormData) => void;
  onNext: () => void;
}) {
  const [newDifferentiator, setNewDifferentiator] = useState('');

  const addDifferentiator = () => {
    if (newDifferentiator.trim()) {
      onChange({
        ...data,
        competitorDifferentiators: [...data.competitorDifferentiators, newDifferentiator.trim()],
      });
      setNewDifferentiator('');
    }
  };

  const removeDifferentiator = (index: number) => {
    onChange({
      ...data,
      competitorDifferentiators: data.competitorDifferentiators.filter((_, i) => i !== index),
    });
  };

  const isValid = data.objective && data.targetAudience.trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Creative Brief</h2>
        <p className="text-sm text-slate-400 mt-2">
          Define your campaign context to generate targeted creative.
        </p>
      </div>

      <div className="space-y-6">
        {/* Objective Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Campaign Objective
          </label>
          <div className="grid grid-cols-2 gap-3">
            {CREATIVE_OBJECTIVES.map((obj) => (
              <button
                key={obj.value}
                onClick={() => onChange({ ...data, objective: obj.value })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  data.objective === obj.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <p className="text-sm font-medium text-slate-200">{obj.label}</p>
                <p className="text-xs text-slate-400 mt-1">{obj.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Target Audience */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Target Audience
          </label>
          <textarea
            value={data.targetAudience}
            onChange={(e) => onChange({ ...data, targetAudience: e.target.value })}
            placeholder="e.g., Homeowners in Seattle area, 35-55, interested in home improvement..."
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
            rows={3}
          />
        </div>

        {/* Promotion Context */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Promotion / Offer Context <span className="text-slate-500">(optional)</span>
          </label>
          <input
            type="text"
            value={data.promotionContext}
            onChange={(e) => onChange({ ...data, promotionContext: e.target.value })}
            placeholder="e.g., 20% off installation, Free consultation, Holiday sale..."
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
          />
        </div>

        {/* Brand Voice */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Brand Voice
          </label>
          <div className="flex flex-wrap gap-2">
            {BRAND_VOICE_OPTIONS.map((voice) => (
              <button
                key={voice}
                onClick={() => onChange({ ...data, brandVoice: voice })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  data.brandVoice === voice
                    ? 'bg-purple-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {voice}
              </button>
            ))}
          </div>
        </div>

        {/* Differentiators */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Key Differentiators <span className="text-slate-500">(what makes you different)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newDifferentiator}
              onChange={(e) => setNewDifferentiator(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDifferentiator()}
              placeholder="e.g., 50+ years experience, Same-day service..."
              className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
            />
            <button
              onClick={addDifferentiator}
              className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
            >
              Add
            </button>
          </div>
          {data.competitorDifferentiators.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.competitorDifferentiators.map((diff, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300"
                >
                  {diff}
                  <button
                    onClick={() => removeDifferentiator(idx)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end mt-8">
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isValid
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          Continue to Channels
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: Channels
// ============================================================================

function ChannelsStep({
  selectedChannels,
  onChange,
  onNext,
  onBack,
}: {
  selectedChannels: MediaChannel[];
  onChange: (channels: MediaChannel[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const availableChannels: MediaChannel[] = [
    'search', 'lsa', 'maps', 'social', 'display', 'youtube', 'radio', 'email',
  ];

  const toggleChannel = (channel: MediaChannel) => {
    const updated = selectedChannels.includes(channel)
      ? selectedChannels.filter(c => c !== channel)
      : [...selectedChannels, channel];
    onChange(updated);
  };

  const isValid = selectedChannels.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Select Channels</h2>
        <p className="text-sm text-slate-400 mt-2">
          Choose the channels you want creative generated for.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {availableChannels.map((channel) => {
          const formats = CHANNEL_CREATIVE_FORMATS[channel] || [];
          const isSelected = selectedChannels.includes(channel);

          return (
            <button
              key={channel}
              onClick={() => toggleChannel(channel)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-200">
                  {CHANNEL_LABELS[channel] || channel}
                </span>
                {isSelected && (
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {formats.slice(0, 2).map((format) => (
                  <span
                    key={format}
                    className="px-1.5 py-0.5 bg-slate-700/50 rounded text-[10px] text-slate-400"
                  >
                    {format.replace(/_/g, ' ')}
                  </span>
                ))}
                {formats.length > 2 && (
                  <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                    +{formats.length - 2} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isValid
              ? 'bg-purple-500 text-white hover:bg-purple-600'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          Generate Creative
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 3: Generate (Loading State)
// ============================================================================

function GenerateStep({
  brief,
  channels,
  onComplete,
  onBack,
}: {
  brief: BriefFormData;
  channels: MediaChannel[];
  onComplete: (pkg: CreativePackage) => void;
  onBack: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const generateCreative = async () => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 500);

      const response = await fetch('/api/media/creative/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: brief.objective,
          channels,
          targetAudience: brief.targetAudience,
          promotionContext: brief.promotionContext,
          brandVoice: brief.brandVoice,
          competitorDifferentiators: brief.competitorDifferentiators,
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate creative');
      }

      const result = await response.json();
      onComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto text-center">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Generate Creative</h2>
        <p className="text-sm text-slate-400 mt-2">
          AI will create channel-specific creative based on your brief.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8 text-left">
        <h3 className="text-sm font-medium text-slate-300 mb-4">Creative Brief Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Objective</span>
            <span className="text-slate-200 capitalize">{brief.objective.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Channels</span>
            <span className="text-slate-200">{channels.length} selected</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Brand Voice</span>
            <span className="text-slate-200">{brief.brandVoice || 'Default'}</span>
          </div>
          {brief.promotionContext && (
            <div className="flex justify-between">
              <span className="text-slate-500">Promotion</span>
              <span className="text-slate-200 truncate max-w-[200px]">{brief.promotionContext}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress / Error */}
      {isGenerating && (
        <div className="mb-6">
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">Generating creative concepts...</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isGenerating}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={generateCreative}
          disabled={isGenerating}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isGenerating
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          }`}
        >
          {isGenerating ? 'Generating...' : 'Generate Creative'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Step 4: Review
// ============================================================================

function ReviewStep({
  creativePackage,
  onBack,
  onExport,
}: {
  creativePackage: CreativePackage;
  onBack: () => void;
  onExport: () => void;
}) {
  const [expandedChannel, setExpandedChannel] = useState<MediaChannel | null>(
    creativePackage.channelCreatives[0]?.channel || null
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-100">Review Creative</h2>
        <p className="text-sm text-slate-400 mt-2">
          Review and customize your AI-generated creative.
        </p>
      </div>

      {/* Theme & Core Messaging */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Campaign Theme</h3>
        <p className="text-lg text-slate-100 mb-4">{creativePackage.overallTheme}</p>

        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Key Messages</h4>
        <div className="space-y-2">
          {creativePackage.keyMessages.map((message: string, idx: number) => (
            <div key={idx} className="flex items-start gap-2">
              <svg className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-300">{message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Channel Creative */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-300">Channel Creative</h3>

        {creativePackage.channelCreatives.map((creative) => (
          <div
            key={creative.channel}
            className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setExpandedChannel(
                expandedChannel === creative.channel ? null : creative.channel
              )}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-200">
                  {CHANNEL_LABELS[creative.channel] || creative.channel}
                </span>
                <span className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-400">
                  {creative.format.replace(/_/g, ' ')}
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-slate-500 transition-transform ${
                  expandedChannel === creative.channel ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedChannel === creative.channel && (
              <div className="p-4 pt-0 border-t border-slate-700 space-y-4">
                {/* Ad Copy */}
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Ad Copy</h4>
                  <div className="space-y-3">
                    {creative.adCopy.headlines.map((headline, idx) => (
                      <div key={idx} className="p-3 bg-slate-900/50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Headline {idx + 1}</p>
                        <p className="text-sm font-medium text-slate-200">{headline}</p>
                      </div>
                    ))}
                    {creative.adCopy.descriptions.map((desc, idx) => (
                      <div key={idx} className="p-3 bg-slate-900/50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Description {idx + 1}</p>
                        <p className="text-sm text-slate-300">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hooks */}
                {creative.messaging.hooks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Hooks</h4>
                    <div className="flex flex-wrap gap-2">
                      {creative.messaging.hooks.map((hook, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-xs text-purple-300"
                        >
                          {hook}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTAs */}
                {creative.adCopy.callsToAction.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Call to Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      {creative.adCopy.callsToAction.map((cta: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300"
                        >
                          {cta}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scripts (for radio/video) */}
                {creative.scripts && creative.scripts.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Scripts</h4>
                    {creative.scripts.map((script, idx) => (
                      <div key={idx} className="p-3 bg-slate-900/50 rounded-lg">
                        <p className="text-xs text-slate-500 mb-1">Script {idx + 1}</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{script}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Back to Generate
        </button>
        <div className="flex gap-3">
          <button
            onClick={onExport}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Export as PDF
          </button>
          <button
            onClick={onExport}
            className="px-6 py-2.5 rounded-xl text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 transition-colors"
          >
            Save to Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CreativeLabWizard({ companyId, companyName, onClose }: CreativeLabWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<CreativeStep>('brief');

  // Form state
  const [brief, setBrief] = useState<BriefFormData>({
    objective: 'conversion',
    targetAudience: '',
    promotionContext: '',
    brandVoice: 'Professional & Trustworthy',
    competitorDifferentiators: [],
  });
  const [selectedChannels, setSelectedChannels] = useState<MediaChannel[]>(['search', 'social']);
  const [creativePackage, setCreativePackage] = useState<CreativePackage | null>(null);

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Exporting creative package:', creativePackage);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/c/${companyId}/diagnostics/media`}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors mb-1 inline-block"
            >
              &larr; Back to Media Lab
            </Link>
            <h1 className="text-xl font-semibold text-slate-100">Creative Lab</h1>
            <p className="text-sm text-slate-400">{companyName}</p>
          </div>
          <button
            onClick={onClose || (() => router.push(`/c/${companyId}/diagnostics/media`))}
            className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={step} />

      {/* Step Content */}
      <div className="max-w-4xl mx-auto">
        {step === 'brief' && (
          <BriefStep
            data={brief}
            onChange={setBrief}
            onNext={() => setStep('channels')}
          />
        )}

        {step === 'channels' && (
          <ChannelsStep
            selectedChannels={selectedChannels}
            onChange={setSelectedChannels}
            onNext={() => setStep('generate')}
            onBack={() => setStep('brief')}
          />
        )}

        {step === 'generate' && (
          <GenerateStep
            brief={brief}
            channels={selectedChannels}
            onComplete={(pkg) => {
              setCreativePackage(pkg);
              setStep('review');
            }}
            onBack={() => setStep('channels')}
          />
        )}

        {step === 'review' && creativePackage && (
          <ReviewStep
            creativePackage={creativePackage}
            onBack={() => setStep('generate')}
            onExport={handleExport}
          />
        )}
      </div>
    </div>
  );
}
