'use client';

// app/c/[companyId]/setup/StepMediaFoundations.tsx
// Step 6: Media Foundations

import { SetupFormData } from './types';
import { FormSection, FormField, TagInput, LabLink, inputStyles } from './components/StepContainer';

interface StepMediaFoundationsProps {
  companyId: string;
  formData: Partial<SetupFormData>;
  updateStepData: <K extends keyof SetupFormData>(
    stepKey: K,
    data: Partial<SetupFormData[K]>
  ) => void;
  errors: Record<string, string[]>;
}

const CHANNEL_OPTIONS = [
  { id: 'google_search', label: 'Google Search', icon: '🔍' },
  { id: 'google_pmax', label: 'Google Performance Max', icon: '⚡' },
  { id: 'google_display', label: 'Google Display', icon: '📊' },
  { id: 'google_youtube', label: 'YouTube', icon: '📺' },
  { id: 'meta_facebook', label: 'Meta (Facebook/Instagram)', icon: '📱' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'microsoft_ads', label: 'Microsoft Ads', icon: '🪟' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'programmatic', label: 'Programmatic Display', icon: '🖥️' },
  { id: 'native', label: 'Native Advertising', icon: '📰' },
  { id: 'connected_tv', label: 'Connected TV', icon: '📺' },
  { id: 'audio', label: 'Audio/Podcast', icon: '🎧' },
];

const ATTRIBUTION_MODELS = [
  { value: 'last_click', label: 'Last Click', description: 'Credit to final touchpoint' },
  { value: 'first_click', label: 'First Click', description: 'Credit to first touchpoint' },
  { value: 'linear', label: 'Linear', description: 'Equal credit to all touchpoints' },
  { value: 'time_decay', label: 'Time Decay', description: 'More credit to recent touches' },
  { value: 'position_based', label: 'Position Based', description: '40/20/40 split' },
  { value: 'data_driven', label: 'Data-Driven', description: 'ML-based attribution' },
];

const MEDIA_ISSUE_SUGGESTIONS = [
  'Poor quality score',
  'High CPCs',
  'Low conversion rate',
  'Limited reach',
  'Creative fatigue',
  'Tracking gaps',
  'Budget pacing issues',
  'Audience overlap',
  'Low impression share',
];

const MEDIA_OPPORTUNITY_SUGGESTIONS = [
  'Expand to new channels',
  'Better audience targeting',
  'Creative refresh',
  'Bid strategy optimization',
  'Landing page testing',
  'Remarketing expansion',
  'Offline conversion import',
  'Enhanced conversions',
];

export function StepMediaFoundations({
  companyId,
  formData,
  updateStepData,
}: StepMediaFoundationsProps) {
  const data = formData.mediaFoundations || {
    mediaSummary: '',
    activeChannels: [],
    attributionModel: '',
    mediaIssues: [],
    mediaOpportunities: [],
  };

  const update = (changes: Partial<typeof data>) => {
    updateStepData('mediaFoundations', changes);
  };

  const toggleChannel = (channelId: string) => {
    const current = data.activeChannels || [];
    if (current.includes(channelId)) {
      update({ activeChannels: current.filter((c) => c !== channelId) });
    } else {
      update({ activeChannels: [...current, channelId] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Lab Integration Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="font-medium text-blue-300">Full Media Planning</div>
          <div className="text-sm text-blue-400/80 mt-0.5">
            Use Media Lab for detailed channel recommendations and budget allocation
          </div>
        </div>
        <LabLink companyId={companyId} lab="media" label="Open Media Lab" />
      </div>

      {/* Media Overview */}
      <FormSection
        title="Media Overview"
        description="Current state of paid media performance"
      >
        <FormField
          label="Media Summary"
          hint="Brief overview of current paid media situation"
        >
          <textarea
            value={data.mediaSummary}
            onChange={(e) => update({ mediaSummary: e.target.value })}
            className={inputStyles.textarea}
            rows={3}
            placeholder="e.g., 'Currently running Google Search and Meta Ads with $50k/month total spend. Google Search is performing well at 4x ROAS, Meta is struggling at 1.5x ROAS. Primary focus is lead generation.'"
          />
        </FormField>
      </FormSection>

      {/* Active Channels */}
      <FormSection
        title="Active & Planned Channels"
        description="Which channels are you using or planning to use?"
      >
        <div className="grid grid-cols-3 gap-3">
          {CHANNEL_OPTIONS.map((channel) => {
            const isActive = (data.activeChannels || []).includes(channel.id);
            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => toggleChannel(channel.id)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  isActive
                    ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500/30'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{channel.icon}</span>
                  <span className={`text-sm font-medium ${isActive ? 'text-purple-300' : 'text-slate-300'}`}>
                    {channel.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </FormSection>

      {/* Attribution */}
      <FormSection
        title="Attribution"
        description="How do you measure marketing effectiveness?"
      >
        <FormField label="Attribution Model" hint="How do you attribute conversions to channels?">
          <div className="grid grid-cols-3 gap-3">
            {ATTRIBUTION_MODELS.map((model) => (
              <button
                key={model.value}
                type="button"
                onClick={() => update({ attributionModel: model.value })}
                className={`text-left p-3 rounded-lg border transition-all ${
                  data.attributionModel === model.value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="font-medium text-sm text-slate-200">{model.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{model.description}</div>
              </button>
            ))}
          </div>
        </FormField>
      </FormSection>

      {/* Issues & Opportunities */}
      <FormSection
        title="Issues & Opportunities"
        description="Current challenges and areas for improvement"
      >
        <div className="grid grid-cols-2 gap-6">
          <FormField
            label="Current Issues"
            hint="Challenges you're facing with media"
          >
            <TagInput
              value={data.mediaIssues}
              onChange={(tags) => update({ mediaIssues: tags })}
              placeholder="Add media issues..."
              suggestions={MEDIA_ISSUE_SUGGESTIONS}
            />
          </FormField>

          <FormField
            label="Opportunities"
            hint="Areas where you could improve"
          >
            <TagInput
              value={data.mediaOpportunities}
              onChange={(tags) => update({ mediaOpportunities: tags })}
              placeholder="Add opportunities..."
              suggestions={MEDIA_OPPORTUNITY_SUGGESTIONS}
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}
