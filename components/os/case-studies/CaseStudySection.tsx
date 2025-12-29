'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  AlertCircle,
  Wrench,
  Target,
  ChevronDown,
} from 'lucide-react';

type SectionType = 'summary' | 'problem' | 'approach' | 'outcome';

interface CaseStudySectionProps {
  type: SectionType;
  content: string | null | undefined;
  isEditMode: boolean;
  onChange?: (value: string) => void;
  defaultExpanded?: boolean;
}

const SECTION_CONFIG: Record<
  SectionType,
  {
    label: string;
    icon: typeof FileText;
    placeholder: string;
    color: string;
  }
> = {
  summary: {
    label: 'Summary',
    icon: FileText,
    placeholder: 'Brief overview of the project...',
    color: 'text-blue-400',
  },
  problem: {
    label: 'Problem',
    icon: AlertCircle,
    placeholder: 'What challenge did the client face?',
    color: 'text-orange-400',
  },
  approach: {
    label: 'Approach',
    icon: Wrench,
    placeholder: 'How did you solve it?',
    color: 'text-purple-400',
  },
  outcome: {
    label: 'Outcome',
    icon: Target,
    placeholder: 'What were the results?',
    color: 'text-green-400',
  },
};

export default function CaseStudySection({
  type,
  content,
  isEditMode,
  onChange,
  defaultExpanded = false,
}: CaseStudySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const config = SECTION_CONFIG[type];
  const Icon = config.icon;
  const hasContent = !!content?.trim();

  // Auto-expand in edit mode
  useEffect(() => {
    if (isEditMode) {
      setIsExpanded(true);
    }
  }, [isEditMode]);

  // Measure content height for animation
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [content, isExpanded, isEditMode]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current && isEditMode) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content, isEditMode]);

  const toggleExpanded = () => {
    if (!isEditMode) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={toggleExpanded}
        disabled={isEditMode}
        className={`
          w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
          ${!isEditMode ? 'hover:bg-slate-800/50 cursor-pointer' : 'cursor-default'}
          ${isExpanded ? 'border-b border-slate-800' : ''}
        `}
      >
        {/* Icon */}
        <div className={`flex-shrink-0 ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Label + Preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{config.label}</span>
            {!hasContent && !isEditMode && (
              <span className="text-xs text-slate-500 italic">Empty</span>
            )}
          </div>

          {/* Preview (collapsed state) */}
          {!isExpanded && hasContent && (
            <p className="text-sm text-slate-400 mt-0.5 line-clamp-2">
              {content}
            </p>
          )}
        </div>

        {/* Expand/Collapse indicator */}
        {!isEditMode && (
          <ChevronDown
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Expandable content */}
      <div
        style={{
          maxHeight: isExpanded ? contentHeight : 0,
          opacity: isExpanded ? 1 : 0,
        }}
        className="transition-all duration-200 ease-out overflow-hidden"
      >
        <div ref={contentRef} className="px-4 py-3">
          {isEditMode ? (
            <textarea
              ref={textareaRef}
              value={content || ''}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder={config.placeholder}
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none min-h-[80px]"
            />
          ) : hasContent ? (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          ) : (
            <p className="text-sm text-slate-500 italic">
              No content yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper component to display all sections together
interface CaseStudySectionsProps {
  summary: string | null | undefined;
  problem: string | null | undefined;
  approach: string | null | undefined;
  outcome: string | null | undefined;
  isEditMode: boolean;
  onChangeSummary?: (value: string) => void;
  onChangeProblem?: (value: string) => void;
  onChangeApproach?: (value: string) => void;
  onChangeOutcome?: (value: string) => void;
}

export function CaseStudySections({
  summary,
  problem,
  approach,
  outcome,
  isEditMode,
  onChangeSummary,
  onChangeProblem,
  onChangeApproach,
  onChangeOutcome,
}: CaseStudySectionsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        The Story
      </h3>
      <div className="space-y-2">
        <CaseStudySection
          type="summary"
          content={summary}
          isEditMode={isEditMode}
          onChange={onChangeSummary}
          defaultExpanded
        />
        <CaseStudySection
          type="problem"
          content={problem}
          isEditMode={isEditMode}
          onChange={onChangeProblem}
        />
        <CaseStudySection
          type="approach"
          content={approach}
          isEditMode={isEditMode}
          onChange={onChangeApproach}
        />
        <CaseStudySection
          type="outcome"
          content={outcome}
          isEditMode={isEditMode}
          onChange={onChangeOutcome}
        />
      </div>
    </div>
  );
}
