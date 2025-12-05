'use client';

// components/GuidelinesSection.tsx
// Displays creative guidelines including voice, tone, visual, and testing roadmap

import { useState } from 'react';
import type { CreativeGuidelines } from '@/lib/contextGraph/domains/creative';

interface GuidelinesSectionProps {
  guidelines: CreativeGuidelines;
  onUpdate: (guidelines: CreativeGuidelines) => void;
}

export function GuidelinesSection({ guidelines, onUpdate }: GuidelinesSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedGuidelines, setEditedGuidelines] = useState(guidelines);

  const handleSave = () => {
    onUpdate(editedGuidelines);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedGuidelines(guidelines);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Creative Guidelines</h2>
          <p className="text-sm text-slate-400 mt-1">
            Brand and creative execution guidelines for consistent messaging
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-300 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
          >
            Edit Guidelines
          </button>
        )}
      </div>

      {/* Guidelines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Voice */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-300">Brand Voice</h3>
          </div>
          {isEditing ? (
            <textarea
              value={editedGuidelines.voice}
              onChange={(e) =>
                setEditedGuidelines({ ...editedGuidelines, voice: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-blue-500/50"
              rows={4}
            />
          ) : (
            <p className="text-sm text-slate-400 leading-relaxed">{guidelines.voice}</p>
          )}
        </div>

        {/* Tone */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-slate-300">Tone</h3>
          </div>
          {isEditing ? (
            <textarea
              value={editedGuidelines.tone}
              onChange={(e) =>
                setEditedGuidelines({ ...editedGuidelines, tone: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-purple-500/50"
              rows={4}
            />
          ) : (
            <p className="text-sm text-slate-400 leading-relaxed">{guidelines.tone}</p>
          )}
        </div>
      </div>

      {/* Visual Guidelines */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-slate-300">Visual Identity</h3>
        </div>
        {isEditing ? (
          <textarea
            value={editedGuidelines.visual}
            onChange={(e) =>
              setEditedGuidelines({ ...editedGuidelines, visual: e.target.value })
            }
            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-amber-500/50"
            rows={4}
          />
        ) : (
          <p className="text-sm text-slate-400 leading-relaxed">{guidelines.visual}</p>
        )}
      </div>

      {/* Testing Roadmap */}
      <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-slate-300">Testing Roadmap</h3>
        </div>
        {isEditing ? (
          <div className="space-y-2">
            {editedGuidelines.testingRoadmap.map((item, idx) => (
              <input
                key={idx}
                type="text"
                value={item}
                onChange={(e) => {
                  const newItems = [...editedGuidelines.testingRoadmap];
                  newItems[idx] = e.target.value;
                  setEditedGuidelines({ ...editedGuidelines, testingRoadmap: newItems });
                }}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-emerald-500/50"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {guidelines.testingRoadmap.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 px-4 py-3 rounded-lg bg-slate-800/30 border border-slate-700/50"
              >
                <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-center">
                  {idx + 1}
                </span>
                <p className="text-sm text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Actions */}
      {isEditing && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-amber-500 text-slate-900 rounded-lg hover:bg-amber-400 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}
