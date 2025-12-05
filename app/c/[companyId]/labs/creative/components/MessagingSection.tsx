'use client';

// components/MessagingSection.tsx
// Displays and allows editing of the messaging architecture

import { useState } from 'react';
import type { MessagingArchitecture } from '@/lib/contextGraph/domains/creative';

interface MessagingSectionProps {
  messaging: MessagingArchitecture;
  onUpdate: (messaging: MessagingArchitecture) => void;
}

export function MessagingSection({ messaging, onUpdate }: MessagingSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedMessaging, setEditedMessaging] = useState(messaging);

  const handleSave = () => {
    onUpdate(editedMessaging);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedMessaging(messaging);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Core Value Prop */}
      <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-amber-400">Core Value Proposition</h3>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-slate-400 hover:text-slate-300"
            >
              Edit
            </button>
          )}
        </div>
        {isEditing ? (
          <textarea
            value={editedMessaging.coreValueProp}
            onChange={(e) =>
              setEditedMessaging({ ...editedMessaging, coreValueProp: e.target.value })
            }
            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-lg resize-none focus:outline-none focus:border-amber-500/50"
            rows={3}
          />
        ) : (
          <p className="text-xl text-white leading-relaxed">{messaging.coreValueProp}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Supporting Points */}
        <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-5">
          <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Supporting Points
          </h4>
          {isEditing ? (
            <div className="space-y-2">
              {editedMessaging.supportingPoints.map((point, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={point}
                  onChange={(e) => {
                    const newPoints = [...editedMessaging.supportingPoints];
                    newPoints[idx] = e.target.value;
                    setEditedMessaging({ ...editedMessaging, supportingPoints: newPoints });
                  }}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-blue-500/50"
                />
              ))}
            </div>
          ) : (
            <ul className="space-y-3">
              {messaging.supportingPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Proof Points */}
        <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-5">
          <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Proof Points
          </h4>
          {isEditing ? (
            <div className="space-y-2">
              {editedMessaging.proofPoints.map((point, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={point}
                  onChange={(e) => {
                    const newPoints = [...editedMessaging.proofPoints];
                    newPoints[idx] = e.target.value;
                    setEditedMessaging({ ...editedMessaging, proofPoints: newPoints });
                  }}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-emerald-500/50"
                />
              ))}
            </div>
          ) : (
            <ul className="space-y-3">
              {messaging.proofPoints.map((point, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Differentiators */}
        <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-5">
          <h4 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Differentiators
          </h4>
          {isEditing ? (
            <div className="space-y-2">
              {editedMessaging.differentiators.map((point, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={point}
                  onChange={(e) => {
                    const newPoints = [...editedMessaging.differentiators];
                    newPoints[idx] = e.target.value;
                    setEditedMessaging({ ...editedMessaging, differentiators: newPoints });
                  }}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-purple-500/50"
                />
              ))}
            </div>
          ) : (
            <ul className="space-y-3">
              {messaging.differentiators.map((point, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
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
