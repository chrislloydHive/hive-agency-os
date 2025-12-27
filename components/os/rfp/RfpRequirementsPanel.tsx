// components/os/rfp/RfpRequirementsPanel.tsx
// Displays parsed RFP requirements in a collapsible panel
// V2.5: Part of RFP Intake + Requirements Parsing feature

import { useState } from 'react';
import {
  Calendar,
  CheckSquare,
  ListChecks,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Gauge,
} from 'lucide-react';
import type { ParsedRfpRequirements } from '@/lib/types/rfp';

interface RfpRequirementsPanelProps {
  requirements: ParsedRfpRequirements;
  variant?: 'compact' | 'full';
}

export function RfpRequirementsPanel({
  requirements,
  variant = 'compact',
}: RfpRequirementsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(variant === 'full');

  const hasDeadline = !!requirements.deadline;
  const hasCompliance = requirements.complianceChecklist.length > 0;
  const hasCriteria = requirements.evaluationCriteria.length > 0;
  const hasQuestions = requirements.mustAnswerQuestions.length > 0;
  const hasSections = requirements.requiredResponseSections.length > 0;
  const hasLimits = requirements.pageLimit || requirements.wordLimit;

  const hasContent = hasDeadline || hasCompliance || hasCriteria || hasQuestions || hasSections || hasLimits;

  if (!hasContent) {
    return null;
  }

  // Compact summary for collapsed state
  const summaryParts: string[] = [];
  if (hasDeadline) summaryParts.push('Deadline');
  if (hasCompliance) summaryParts.push(`${requirements.complianceChecklist.length} compliance`);
  if (hasCriteria) summaryParts.push(`${requirements.evaluationCriteria.length} criteria`);
  if (hasQuestions) summaryParts.push(`${requirements.mustAnswerQuestions.length} questions`);

  const confidenceColor = {
    high: 'text-emerald-400',
    medium: 'text-amber-400',
    low: 'text-slate-400',
  }[requirements.parseConfidence || 'low'];

  return (
    <div className="border border-purple-500/20 rounded-lg overflow-hidden bg-purple-500/5">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-purple-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-medium text-purple-300">RFP Requirements</span>
          {requirements.parseConfidence && (
            <span className={`text-[10px] ${confidenceColor}`}>
              ({requirements.parseConfidence})
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>

      {/* Collapsed summary */}
      {!isExpanded && summaryParts.length > 0 && (
        <div className="px-3 pb-2">
          <p className="text-[10px] text-slate-500 truncate">
            {summaryParts.join(' · ')}
          </p>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Deadline */}
          {hasDeadline && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400 mb-1">
                <Calendar className="w-3 h-3" />
                Deadline
              </div>
              <p className="text-xs text-white bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
                {formatDeadline(requirements.deadline!)}
              </p>
            </div>
          )}

          {/* Limits */}
          {hasLimits && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mb-1">
                <Gauge className="w-3 h-3" />
                Limits
              </div>
              <div className="text-xs text-slate-300">
                {requirements.pageLimit && <span>{requirements.pageLimit} pages</span>}
                {requirements.pageLimit && requirements.wordLimit && <span> / </span>}
                {requirements.wordLimit && <span>{requirements.wordLimit.toLocaleString()} words</span>}
              </div>
            </div>
          )}

          {/* Compliance Checklist */}
          {hasCompliance && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mb-1">
                <CheckSquare className="w-3 h-3" />
                Compliance ({requirements.complianceChecklist.length})
              </div>
              <ul className="space-y-1">
                {requirements.complianceChecklist.slice(0, 5).map((item, i) => (
                  <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                    <span className="text-slate-500 mt-0.5">•</span>
                    <span className="line-clamp-2">{item}</span>
                  </li>
                ))}
                {requirements.complianceChecklist.length > 5 && (
                  <li className="text-[10px] text-slate-500">
                    +{requirements.complianceChecklist.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Evaluation Criteria */}
          {hasCriteria && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mb-1">
                <ListChecks className="w-3 h-3" />
                Evaluation Criteria ({requirements.evaluationCriteria.length})
              </div>
              <ul className="space-y-1">
                {requirements.evaluationCriteria.slice(0, 5).map((item, i) => (
                  <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                    <span className="text-slate-500 mt-0.5">•</span>
                    <span className="line-clamp-2">{item}</span>
                  </li>
                ))}
                {requirements.evaluationCriteria.length > 5 && (
                  <li className="text-[10px] text-slate-500">
                    +{requirements.evaluationCriteria.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Must-Answer Questions */}
          {hasQuestions && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mb-1">
                <HelpCircle className="w-3 h-3" />
                Questions to Answer ({requirements.mustAnswerQuestions.length})
              </div>
              <ul className="space-y-1">
                {requirements.mustAnswerQuestions.slice(0, 5).map((item, i) => (
                  <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                    <span className="text-blue-400 mt-0.5">{i + 1}.</span>
                    <span className="line-clamp-2">{item}</span>
                  </li>
                ))}
                {requirements.mustAnswerQuestions.length > 5 && (
                  <li className="text-[10px] text-slate-500">
                    +{requirements.mustAnswerQuestions.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Required Sections */}
          {hasSections && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 mb-1">
                <FileText className="w-3 h-3" />
                Required Sections ({requirements.requiredResponseSections.length})
              </div>
              <ul className="space-y-1">
                {requirements.requiredResponseSections.slice(0, 5).map((section, i) => (
                  <li key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                    <span className="text-slate-500 mt-0.5">•</span>
                    <span className="flex-1 line-clamp-1">{section.title}</span>
                    {(section.pageLimit || section.wordLimit) && (
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {section.pageLimit && `${section.pageLimit}p`}
                        {section.pageLimit && section.wordLimit && ' / '}
                        {section.wordLimit && `${section.wordLimit}w`}
                      </span>
                    )}
                  </li>
                ))}
                {requirements.requiredResponseSections.length > 5 && (
                  <li className="text-[10px] text-slate-500">
                    +{requirements.requiredResponseSections.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format a deadline string for display
 */
function formatDeadline(deadline: string): string {
  try {
    const date = new Date(deadline);
    if (isNaN(date.getTime())) {
      // Not a valid date, return as-is
      return deadline;
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return deadline;
  }
}

/**
 * Minimal badge to show in section headers when requirements mention that section
 */
export function SectionRequirementsBadge({
  sectionKey,
  requirements,
}: {
  sectionKey: string;
  requirements: ParsedRfpRequirements;
}) {
  // Check if this section has specific requirements
  const hasQuestions = requirements.mustAnswerQuestions.some(q =>
    q.toLowerCase().includes(sectionKey.replace(/_/g, ' '))
  );
  const hasCriteria = requirements.evaluationCriteria.some(c =>
    c.toLowerCase().includes(sectionKey.replace(/_/g, ' '))
  );

  if (!hasQuestions && !hasCriteria) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] rounded"
      title={`This section has ${hasQuestions ? 'questions' : ''}${hasQuestions && hasCriteria ? ' and ' : ''}${hasCriteria ? 'evaluation criteria' : ''} in the RFP`}
    >
      <FileText className="w-2.5 h-2.5" />
      RFP
    </span>
  );
}
