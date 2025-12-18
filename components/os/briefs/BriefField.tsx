'use client';

// components/os/briefs/BriefField.tsx
// Editable brief field with inline AI helper

import { useState } from 'react';
import { Sparkles, Loader2, Check, X, RefreshCw } from 'lucide-react';
import type { BriefFieldAction } from '@/lib/types/brief';

interface BriefFieldProps {
  fieldPath: string;
  label: string;
  description?: string;
  value: string | string[];
  type: 'text' | 'textarea' | 'list';
  editable?: boolean;
  onUpdate: (value: string | string[]) => Promise<void>;
  onAIHelper: (action: BriefFieldAction, guidance?: string) => Promise<{ value?: string; variants?: string[] }>;
}

export function BriefField({
  fieldPath,
  label,
  description,
  value,
  type,
  editable = true,
  onUpdate,
  onAIHelper,
}: BriefFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [showAIMenu, setShowAIMenu] = useState(false);

  // Format value for display
  const displayValue = Array.isArray(value) ? value.join('\n') : value;

  // Start editing
  const startEditing = () => {
    setEditValue(displayValue);
    setIsEditing(true);
    setAiSuggestion(null);
  };

  // Save changes
  const saveChanges = async () => {
    setIsSaving(true);
    try {
      const newValue = type === 'list'
        ? editValue.split('\n').filter(Boolean)
        : editValue;
      await onUpdate(newValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditValue('');
    setAiSuggestion(null);
  };

  // Get AI suggestion
  const getAISuggestion = async (action: BriefFieldAction) => {
    setIsAILoading(true);
    setShowAIMenu(false);
    try {
      const result = await onAIHelper(action);
      if (result.value) {
        setAiSuggestion(result.value);
      } else if (result.variants && result.variants.length > 0) {
        setAiSuggestion(result.variants[0]);
      }
    } catch (error) {
      console.error('AI helper failed:', error);
    } finally {
      setIsAILoading(false);
    }
  };

  // Apply AI suggestion
  const applyAISuggestion = () => {
    if (aiSuggestion) {
      setEditValue(aiSuggestion);
      setAiSuggestion(null);
    }
  };

  return (
    <div className="group">
      {/* Label + AI Helper */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {label}
        </label>
        {editable && !isEditing && (
          <div className="relative">
            <button
              onClick={() => setShowAIMenu(!showAIMenu)}
              className="p-1 text-slate-500 hover:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="AI Assistant"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            {showAIMenu && (
              <div className="absolute right-0 top-full mt-1 z-10 w-32 py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
                {(['suggest', 'refine', 'shorten', 'expand'] as BriefFieldAction[]).map((action) => (
                  <button
                    key={action}
                    onClick={() => {
                      startEditing();
                      getAISuggestion(action);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-700/50"
                  >
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-[10px] text-slate-500 mb-2">{description}</p>
      )}

      {/* Value / Editor */}
      {isEditing ? (
        <div className="space-y-2">
          {/* Editor */}
          {type === 'textarea' || type === 'list' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-purple-500 min-h-[80px]"
              placeholder={type === 'list' ? 'One item per line...' : 'Enter value...'}
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-purple-500"
              placeholder="Enter value..."
            />
          )}

          {/* AI Suggestion */}
          {isAILoading && (
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              <span className="text-xs text-purple-300">Generating suggestion...</span>
            </div>
          )}

          {aiSuggestion && !isAILoading && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-purple-300">AI Suggestion</span>
                <button
                  onClick={applyAISuggestion}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-purple-300 bg-purple-500/20 rounded hover:bg-purple-500/30"
                >
                  <Check className="w-3 h-3" />
                  Apply
                </button>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{aiSuggestion}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={saveChanges}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save
            </button>
            <button
              onClick={cancelEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            {!isAILoading && (
              <button
                onClick={() => getAISuggestion('suggest')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-400 hover:text-purple-300 ml-auto"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Suggest
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onClick={editable ? startEditing : undefined}
          className={`p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 ${
            editable ? 'cursor-text hover:border-slate-600' : ''
          }`}
        >
          {displayValue ? (
            type === 'list' ? (
              <ul className="space-y-1">
                {(Array.isArray(value) ? value : value.split('\n')).map((item, i) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-slate-500">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{displayValue}</p>
            )
          ) : (
            <p className="text-sm text-slate-500 italic">
              {editable ? 'Click to add...' : 'Not specified'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BriefField;
