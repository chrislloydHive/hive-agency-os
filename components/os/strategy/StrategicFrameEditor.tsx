'use client';

// components/os/strategy/StrategicFrameEditor.tsx
// Strategic Frame Editor - Define and lock the strategic foundation
//
// The Strategic Frame is the foundational input for all AI-generated strategy content.
// When locked, AI will not propose changes to the frame unless explicitly requested.

import { useState, useCallback, useMemo } from 'react';
import {
  Users,
  Package,
  Zap,
  Compass,
  AlertTriangle,
  TrendingUp,
  XCircle,
  Lock,
  Unlock,
  Sparkles,
  RefreshCw,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Edit3,
  Save,
  X,
  AlertCircle,
} from 'lucide-react';
import type { StrategyFrame } from '@/lib/types/strategy';
import { computeFrameCompleteness, normalizeFrame } from '@/lib/types/strategy';

// ============================================================================
// Types
// ============================================================================

interface StrategicFrameEditorProps {
  frame?: StrategyFrame;
  onUpdate: (frame: StrategyFrame) => Promise<void>;
  onAiFill?: () => Promise<StrategyFrame | null>;
  companyId: string;
  isFinalized?: boolean;
}

interface FrameFieldConfig {
  key: keyof StrategyFrame;
  label: string;
  placeholder: string;
  icon: React.ElementType;
  colorClass: string;
  description: string;
  isArray?: boolean;
  required?: boolean;
}

// ============================================================================
// Field Configuration
// ============================================================================

const FRAME_FIELDS: FrameFieldConfig[] = [
  {
    key: 'audience',
    label: 'Target Audience',
    placeholder: 'e.g., B2B SaaS companies with 50-500 employees looking to improve customer retention',
    icon: Users,
    colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    description: 'Who are you trying to reach?',
    required: true,
  },
  {
    key: 'offering',
    label: 'Primary Offering',
    placeholder: 'e.g., Customer success platform with predictive analytics and automated workflows',
    icon: Package,
    colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    description: 'What do you offer?',
    required: true,
  },
  {
    key: 'valueProp',
    label: 'Value Proposition',
    placeholder: 'e.g., Reduce churn by 40% through AI-powered early warning signals',
    icon: Zap,
    colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    description: 'Why should they choose you?',
    required: true,
  },
  {
    key: 'positioning',
    label: 'Market Positioning',
    placeholder: 'e.g., The only CS platform built specifically for product-led growth companies',
    icon: Compass,
    colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    description: 'How are you different from alternatives?',
    required: true,
  },
  {
    key: 'constraints',
    label: 'Constraints',
    placeholder: 'e.g., Cannot make medical claims, limited to North American market, no enterprise pricing',
    icon: AlertTriangle,
    colorClass: 'text-red-400 bg-red-500/10 border-red-500/30',
    description: 'What limits or restrictions apply?',
    required: false,
  },
  {
    key: 'successMetrics',
    label: 'Success Metrics',
    placeholder: 'Add metrics like "Increase MQLs by 25%" or "Reduce CAC by 20%"',
    icon: TrendingUp,
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    description: 'How will you measure success?',
    isArray: true,
    required: false,
  },
  {
    key: 'nonGoals',
    label: 'Non-Goals',
    placeholder: 'Add items like "Not targeting enterprise" or "Not competing on price"',
    icon: XCircle,
    colorClass: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    description: 'What are you explicitly NOT doing?',
    isArray: true,
    required: false,
  },
];

// ============================================================================
// Completeness Meter
// ============================================================================

function CompletenessMeter({
  percent,
  filled,
  missing,
}: {
  percent: number;
  filled: string[];
  missing: string[];
}) {
  const getColor = () => {
    if (percent >= 80) return 'bg-emerald-500';
    if (percent >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getLabel = () => {
    if (percent >= 80) return 'Strong';
    if (percent >= 50) return 'Partial';
    return 'Needs Work';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Frame Completeness</span>
        <span className={`text-xs font-medium ${percent >= 80 ? 'text-emerald-400' : percent >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
          {percent}% {getLabel()}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} rounded-full transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {missing.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500">Missing:</span>
          {missing.map((field) => (
            <span
              key={field}
              className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 rounded"
            >
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Array Field Editor
// ============================================================================

function ArrayFieldEditor({
  items,
  onChange,
  placeholder,
  readOnly,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  readOnly?: boolean;
}) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim() && !readOnly) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index: number) => {
    if (!readOnly) {
      onChange(items.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded border border-slate-700/50"
        >
          <span className="text-sm text-slate-300 flex-1">{item}</span>
          {!readOnly && (
            <button
              onClick={() => handleRemove(idx)}
              className="text-slate-500 hover:text-red-400 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
            placeholder={placeholder}
            className="flex-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <button
            onClick={handleAdd}
            disabled={!newItem.trim()}
            className="px-2 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Diff Preview Modal
// ============================================================================

function DiffPreviewModal({
  currentFrame,
  suggestedFrame,
  onApply,
  onCancel,
  applying,
}: {
  currentFrame: StrategyFrame;
  suggestedFrame: StrategyFrame;
  onApply: () => void;
  onCancel: () => void;
  applying: boolean;
}) {
  const changes = useMemo(() => {
    const diffs: { field: string; current: string; suggested: string }[] = [];

    for (const fieldConfig of FRAME_FIELDS) {
      const key = fieldConfig.key;
      const current = currentFrame[key];
      const suggested = suggestedFrame[key];

      // Convert to string, handling arrays, strings, and booleans
      const toStr = (val: unknown): string => {
        if (Array.isArray(val)) return val.join(', ');
        if (typeof val === 'string') return val;
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        return val ? String(val) : '';
      };

      const currentStr = toStr(current);
      const suggestedStr = toStr(suggested);

      if (suggestedStr && suggestedStr !== currentStr) {
        diffs.push({
          field: fieldConfig.label,
          current: currentStr || '(empty)',
          suggested: suggestedStr,
        });
      }
    }

    return diffs;
  }, [currentFrame, suggestedFrame]);

  if (changes.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold text-white mb-4">No Changes Suggested</h3>
          <p className="text-sm text-slate-400 mb-4">
            AI analysis found no improvements to suggest for your current frame.
          </p>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Suggested Frame Updates
          </h3>
          <span className="text-xs text-slate-500">{changes.length} changes</span>
        </div>

        <div className="space-y-4 mb-6">
          {changes.map((change, idx) => (
            <div key={idx} className="border border-slate-700 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700">
                <span className="text-sm font-medium text-slate-300">{change.field}</span>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded flex-shrink-0">Current</span>
                  <span className="text-sm text-slate-400 line-through">{change.current}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex-shrink-0">Suggested</span>
                  <span className="text-sm text-emerald-300">{change.suggested}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onApply}
            disabled={applying}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg disabled:opacity-50"
          >
            {applying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Apply All Changes
              </>
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={applying}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Lock Confirmation Modal
// ============================================================================

function LockConfirmationModal({
  isLocking,
  onConfirm,
  onCancel,
}: {
  isLocking: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 flex items-center justify-center rounded-lg flex-shrink-0 ${isLocking ? 'bg-amber-500/10' : 'bg-cyan-500/10'}`}>
            {isLocking ? (
              <Lock className="w-5 h-5 text-amber-400" />
            ) : (
              <Unlock className="w-5 h-5 text-cyan-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">
              {isLocking ? 'Lock Strategic Frame?' : 'Unlock Strategic Frame?'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {isLocking ? (
                <>
                  Once locked, AI will <strong className="text-amber-400">not propose changes</strong> to your frame
                  unless you explicitly ask. This prevents "AI drift" and ensures strategic consistency.
                </>
              ) : (
                <>
                  Unlocking the frame allows AI to <strong className="text-cyan-400">suggest improvements</strong>
                  during strategy generation. Your frame values will still be preserved.
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onConfirm}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg ${
                  isLocking
                    ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                    : 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30'
                }`}
              >
                {isLocking ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {isLocking ? 'Lock Frame' : 'Unlock Frame'}
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategicFrameEditor({
  frame,
  onUpdate,
  onAiFill,
  companyId,
  isFinalized = false,
}: StrategicFrameEditorProps) {
  const [expanded, setExpanded] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string | string[]>('');
  const [saving, setSaving] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [suggestedFrame, setSuggestedFrame] = useState<StrategyFrame | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [isLockingAction, setIsLockingAction] = useState(true);

  // Normalize the frame
  const normalizedFrame = useMemo(() => normalizeFrame(frame), [frame]);

  // Compute completeness
  const completeness = useMemo(() => computeFrameCompleteness(normalizedFrame), [normalizedFrame]);

  const isLocked = normalizedFrame.isLocked || false;
  const isReadOnly = isFinalized || isLocked;

  // Start editing a field
  const handleStartEdit = useCallback((fieldKey: string, isArray: boolean) => {
    if (isReadOnly) return;
    setEditingField(fieldKey);
    const value = normalizedFrame[fieldKey as keyof StrategyFrame];
    if (isArray) {
      setEditValue(Array.isArray(value) ? value : []);
    } else {
      setEditValue(typeof value === 'string' ? value : '');
    }
  }, [normalizedFrame, isReadOnly]);

  // Save field edit
  const handleSaveField = useCallback(async (fieldKey: string) => {
    setSaving(true);
    try {
      await onUpdate({
        ...normalizedFrame,
        [fieldKey]: editValue,
      });
      setEditingField(null);
      setSavedField(fieldKey);
      setTimeout(() => setSavedField(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [normalizedFrame, editValue, onUpdate]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  // AI Fill Frame
  const handleAiFill = useCallback(async () => {
    if (!onAiFill) return;

    setAiLoading(true);
    try {
      const suggested = await onAiFill();
      if (suggested) {
        setSuggestedFrame(suggested);
        setShowDiffPreview(true);
      }
    } finally {
      setAiLoading(false);
    }
  }, [onAiFill]);

  // Apply AI suggestions
  const handleApplySuggestions = useCallback(async () => {
    if (!suggestedFrame) return;

    setSaving(true);
    try {
      // Merge suggested with current, keeping user values where suggested is empty
      const merged: StrategyFrame = { ...normalizedFrame };
      for (const key of Object.keys(suggestedFrame) as (keyof StrategyFrame)[]) {
        const suggested = suggestedFrame[key];
        if (suggested && (typeof suggested === 'string' ? suggested.trim() : Array.isArray(suggested) && suggested.length > 0)) {
          (merged as Record<string, unknown>)[key] = suggested;
        }
      }
      await onUpdate(merged);
      setShowDiffPreview(false);
      setSuggestedFrame(null);
    } finally {
      setSaving(false);
    }
  }, [normalizedFrame, suggestedFrame, onUpdate]);

  // Toggle lock
  const handleToggleLock = useCallback(() => {
    setIsLockingAction(!isLocked);
    setShowLockConfirm(true);
  }, [isLocked]);

  // Confirm lock/unlock
  const handleConfirmLock = useCallback(async () => {
    setSaving(true);
    try {
      await onUpdate({
        ...normalizedFrame,
        isLocked: isLockingAction,
        lockedAt: isLockingAction ? new Date().toISOString() : undefined,
      });
      setShowLockConfirm(false);
    } finally {
      setSaving(false);
    }
  }, [normalizedFrame, isLockingAction, onUpdate]);

  return (
    <>
      <div id="strategic-frame" className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden scroll-mt-20">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50"
        >
          <div className="flex items-center gap-3">
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
            <Compass className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-semibold text-white">Strategic Frame</span>
            {isLocked && (
              <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-full">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${completeness.percent >= 80 ? 'text-emerald-400' : completeness.percent >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {completeness.percent}%
            </span>
            {!expanded && completeness.missing.length > 0 && (
              <span className="text-[10px] text-slate-500">
                {completeness.missing.length} missing
              </span>
            )}
          </div>
        </button>

        {/* Content */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4">
            {/* Completeness Meter */}
            <CompletenessMeter
              percent={completeness.percent}
              filled={completeness.filled}
              missing={completeness.missing}
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pb-2 border-b border-slate-700/50">
              {onAiFill && !isReadOnly && (
                <button
                  onClick={handleAiFill}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 disabled:opacity-50"
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      AI Fill Frame
                    </>
                  )}
                </button>
              )}
              {!isFinalized && (
                <button
                  onClick={handleToggleLock}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${
                    isLocked
                      ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20'
                      : 'text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20'
                  }`}
                >
                  {isLocked ? (
                    <>
                      <Unlock className="w-3 h-3" />
                      Unlock Frame
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" />
                      Lock Frame
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Fields */}
            <div className="space-y-4">
              {FRAME_FIELDS.map((fieldConfig) => {
                const value = normalizedFrame[fieldConfig.key as keyof StrategyFrame];
                const isEditing = editingField === fieldConfig.key;
                const isSaved = savedField === fieldConfig.key;
                const Icon = fieldConfig.icon;

                return (
                  <div key={fieldConfig.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${fieldConfig.colorClass.split(' ').slice(1).join(' ')}`}>
                          <Icon className={`w-3.5 h-3.5 ${fieldConfig.colorClass.split(' ')[0]}`} />
                        </div>
                        <span className="text-sm font-medium text-slate-300">
                          {fieldConfig.label}
                          {fieldConfig.required && <span className="text-red-400 ml-1">*</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSaved && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Saved
                          </span>
                        )}
                        {!isReadOnly && !isEditing && (
                          <button
                            onClick={() => handleStartEdit(fieldConfig.key, fieldConfig.isArray || false)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 ml-8">{fieldConfig.description}</p>

                    {isEditing ? (
                      <div className="ml-8 space-y-2">
                        {fieldConfig.isArray ? (
                          <ArrayFieldEditor
                            items={Array.isArray(editValue) ? editValue : []}
                            onChange={(items) => setEditValue(items)}
                            placeholder={fieldConfig.placeholder}
                          />
                        ) : (
                          <textarea
                            value={typeof editValue === 'string' ? editValue : ''}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder={fieldConfig.placeholder}
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                          />
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveField(fieldConfig.key)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50"
                          >
                            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-xs text-slate-400 hover:text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-8">
                        {fieldConfig.isArray ? (
                          Array.isArray(value) && value.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {value.map((item, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-1 text-xs rounded border ${fieldConfig.colorClass}`}
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">Not defined</p>
                          )
                        ) : value && typeof value === 'string' ? (
                          <p className="text-sm text-slate-300">{value}</p>
                        ) : (
                          <p className="text-sm text-slate-500 italic">Not defined</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Locked Warning */}
            {isLocked && (
              <div className="flex items-start gap-3 px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-400 font-medium">Frame is Locked</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    AI will not propose changes to these values. Unlock to allow AI suggestions.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Diff Preview Modal */}
      {showDiffPreview && suggestedFrame && (
        <DiffPreviewModal
          currentFrame={normalizedFrame}
          suggestedFrame={suggestedFrame}
          onApply={handleApplySuggestions}
          onCancel={() => {
            setShowDiffPreview(false);
            setSuggestedFrame(null);
          }}
          applying={saving}
        />
      )}

      {/* Lock Confirmation Modal */}
      {showLockConfirm && (
        <LockConfirmationModal
          isLocking={isLockingAction}
          onConfirm={handleConfirmLock}
          onCancel={() => setShowLockConfirm(false)}
        />
      )}
    </>
  );
}
