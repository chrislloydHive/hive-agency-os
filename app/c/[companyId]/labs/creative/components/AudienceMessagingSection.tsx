'use client';

// components/AudienceMessagingSection.tsx
// Displays segment-specific messaging with headlines, CTAs, and objection handling

import { useState } from 'react';
import type { SegmentMessage } from '@/lib/contextGraph/domains/creative';
import type { CreativeAudienceSegment } from '../loadCreativeLab';

interface AudienceMessagingSectionProps {
  segmentMessages: Record<string, SegmentMessage>;
  segments: CreativeAudienceSegment[];
  onUpdate: (messages: Record<string, SegmentMessage>) => void;
}

export function AudienceMessagingSection({
  segmentMessages,
  segments,
  onUpdate,
}: AudienceMessagingSectionProps) {
  const [expandedSegment, setExpandedSegment] = useState<string | null>(
    Object.keys(segmentMessages)[0] || null
  );

  const segmentNames = Object.keys(segmentMessages);

  if (segmentNames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">No Segment Messaging</h3>
        <p className="text-slate-500 max-w-md">
          Add audience segments in Setup or Audience Lab to generate segment-specific messaging.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {segmentNames.map((segmentName) => {
        const message = segmentMessages[segmentName];
        const isExpanded = expandedSegment === segmentName;
        const segment = segments.find((s) => s.name === segmentName);

        return (
          <div
            key={segmentName}
            className="rounded-lg bg-slate-900/50 border border-slate-800 overflow-hidden"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedSegment(isExpanded ? null : segmentName)}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
            >
              <div>
                <h3 className="text-base font-medium text-white">{segmentName}</h3>
                <p className="text-sm text-slate-400 mt-1 line-clamp-1">{message.valueProp}</p>
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
              <div className="px-5 pb-5 space-y-6 border-t border-slate-800/50">
                {/* Value Prop */}
                <div className="pt-5">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Value Proposition
                  </h4>
                  <p className="text-slate-200">{message.valueProp}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pains Addressed */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                      Pains Addressed
                    </h4>
                    <ul className="space-y-2">
                      {message.painsAddressed.map((pain, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-red-400 mt-1">•</span>
                          {pain}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Outcomes */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                      Desired Outcomes
                    </h4>
                    <ul className="space-y-2">
                      {message.outcomes.map((outcome, idx) => (
                        <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                          <span className="text-emerald-400 mt-1">•</span>
                          {outcome}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Objections */}
                {Object.keys(message.objections).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                      Objection Handling
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(message.objections).map(([objection, response], idx) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-slate-800/30 border border-slate-700/50 p-4"
                        >
                          <p className="text-sm text-amber-400 font-medium mb-2">
                            &ldquo;{objection}&rdquo;
                          </p>
                          <p className="text-sm text-slate-300">{response}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Headlines */}
                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Example Headlines
                  </h4>
                  <div className="space-y-2">
                    {message.exampleHeadlines.map((headline, idx) => (
                      <div
                        key={idx}
                        className="px-4 py-3 rounded-lg bg-gradient-to-r from-slate-800/50 to-slate-800/30 border border-slate-700/50"
                      >
                        <p className="text-sm text-white font-medium">{headline}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTAs */}
                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                    Recommended CTAs
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {message.ctas.map((cta, idx) => (
                      <span
                        key={idx}
                        className="px-4 py-2 rounded-full bg-amber-500/10 text-amber-400 text-sm font-medium border border-amber-500/20"
                      >
                        {cta}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
