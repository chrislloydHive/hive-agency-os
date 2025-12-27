'use client';

// components/os/plans/editor/CampaignsEditor.tsx
// Editor for campaigns in a media plan

import { useCallback, useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { MediaCampaign } from '@/lib/types/plan';

interface CampaignsEditorProps {
  campaigns: MediaCampaign[];
  onChange: (campaigns: MediaCampaign[]) => void;
  readOnly?: boolean;
}

function generateId(): string {
  return `camp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function CampaignsEditor({
  campaigns,
  onChange,
  readOnly = false,
}: CampaignsEditorProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const addCampaign = useCallback(() => {
    const newCampaign: MediaCampaign = {
      id: generateId(),
      name: '',
      channel: '',
      offer: '',
      targeting: '',
      creativeNeeds: '',
      flighting: {
        startDate: '',
        endDate: '',
      },
      budget: 0,
      kpis: {},
    };
    onChange([...campaigns, newCampaign]);
    setExpandedIds((prev) => new Set(prev).add(newCampaign.id));
  }, [campaigns, onChange]);

  const removeCampaign = useCallback(
    (id: string) => {
      onChange(campaigns.filter((c) => c.id !== id));
    },
    [campaigns, onChange]
  );

  const updateCampaign = useCallback(
    (id: string, updates: Partial<MediaCampaign>) => {
      onChange(
        campaigns.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        )
      );
    },
    [campaigns, onChange]
  );

  if (campaigns.length === 0 && readOnly) {
    return <p className="text-sm text-slate-500 italic">No campaigns defined</p>;
  }

  return (
    <div className="space-y-3">
      {campaigns.map((campaign) => {
        const isExpanded = expandedIds.has(campaign.id);

        return (
          <div
            key={campaign.id}
            className="border border-slate-700/30 rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-slate-900/30">
              <button
                onClick={() => toggleExpanded(campaign.id)}
                className="flex items-center gap-2 text-left flex-1"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-200">
                  {campaign.name || 'Untitled Campaign'}
                </span>
                {campaign.channel && (
                  <span className="text-xs text-slate-500">({campaign.channel})</span>
                )}
              </button>
              {!readOnly && (
                <button
                  onClick={() => removeCampaign(campaign.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                  title="Remove campaign"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="p-4 space-y-4 border-t border-slate-700/30">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Campaign Name</label>
                    <input
                      type="text"
                      value={campaign.name}
                      onChange={(e) => updateCampaign(campaign.id, { name: e.target.value })}
                      placeholder="Campaign name"
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Channel</label>
                    <input
                      type="text"
                      value={campaign.channel}
                      onChange={(e) => updateCampaign(campaign.id, { channel: e.target.value })}
                      placeholder="e.g., Google Ads"
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Offer</label>
                  <input
                    type="text"
                    value={campaign.offer}
                    onChange={(e) => updateCampaign(campaign.id, { offer: e.target.value })}
                    placeholder="What's the offer or value proposition?"
                    readOnly={readOnly}
                    className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Targeting</label>
                  <textarea
                    value={campaign.targeting}
                    onChange={(e) => updateCampaign(campaign.id, { targeting: e.target.value })}
                    placeholder="Describe the targeting criteria..."
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 resize-none ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Creative Needs</label>
                  <textarea
                    value={campaign.creativeNeeds}
                    onChange={(e) => updateCampaign(campaign.id, { creativeNeeds: e.target.value })}
                    placeholder="What creative assets are needed?"
                    readOnly={readOnly}
                    rows={2}
                    className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 resize-none ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={campaign.flighting.startDate}
                      onChange={(e) =>
                        updateCampaign(campaign.id, {
                          flighting: { ...campaign.flighting, startDate: e.target.value },
                        })
                      }
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">End Date</label>
                    <input
                      type="date"
                      value={campaign.flighting.endDate}
                      onChange={(e) =>
                        updateCampaign(campaign.id, {
                          flighting: { ...campaign.flighting, endDate: e.target.value },
                        })
                      }
                      readOnly={readOnly}
                      className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 ${
                        readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Budget</label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-slate-400">$</span>
                      <input
                        type="number"
                        value={campaign.budget || ''}
                        onChange={(e) =>
                          updateCampaign(campaign.id, { budget: parseFloat(e.target.value) || 0 })
                        }
                        placeholder="0"
                        readOnly={readOnly}
                        className={`flex-1 px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                          readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <button
          onClick={addCampaign}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-600/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Campaign
        </button>
      )}
    </div>
  );
}

export default CampaignsEditor;
