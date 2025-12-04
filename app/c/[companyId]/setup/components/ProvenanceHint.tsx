'use client';

// app/c/[companyId]/setup/components/ProvenanceHint.tsx
// Provenance Hint - Shows where a field value came from
//
// Displays a subtle hint under form fields showing:
// - Source of the value (e.g., "GAP Heavy", "Website Lab")
// - When it was last updated
// - Whether it was human-edited

import type { ContextNodeInfo } from '@/lib/contextGraph/setupSchema';

interface ProvenanceHintProps {
  /** Provenance info from the loader */
  provenance: ContextNodeInfo | null;
  /** Whether the field is currently missing/empty */
  isMissing?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}

export function ProvenanceHint({
  provenance,
  isMissing = false,
  className = '',
}: ProvenanceHintProps) {
  // If missing and no provenance, show helper text
  if (isMissing && !provenance) {
    return (
      <p className={`text-[11px] text-slate-500 mt-1 ${className}`}>
        Not yet in Brain. Filling this adds it to the Context Graph.
      </p>
    );
  }

  // If no provenance, nothing to show
  if (!provenance) {
    return null;
  }

  // Build display text
  const parts: string[] = [];

  if (provenance.sourceName) {
    parts.push(`Pre-filled from ${provenance.sourceName}`);
  }

  if (provenance.updatedAt) {
    parts.push(formatRelativeTime(provenance.updatedAt));
  }

  if (parts.length === 0) {
    return null;
  }

  // Different styling for human-edited vs auto-populated
  if (provenance.isHumanOverride) {
    return (
      <p className={`text-[11px] text-emerald-500/70 mt-1 flex items-center gap-1 ${className}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Edited in {provenance.sourceName || 'Setup'} · {provenance.updatedAt ? formatRelativeTime(provenance.updatedAt) : ''}
      </p>
    );
  }

  return (
    <p className={`text-[11px] text-slate-500 mt-1 ${className}`}>
      {parts.join(' · ')}
    </p>
  );
}

/**
 * Wrapper for form fields that adds provenance hint
 */
interface FieldWithProvenanceProps {
  /** Context path for looking up provenance */
  contextPath: string;
  /** Provenance map from Setup client */
  provenanceMap: Map<string, ContextNodeInfo>;
  /** Missing fields list */
  missingFields: string[];
  /** Field label */
  label: string;
  /** Whether the field is required */
  required?: boolean;
  /** Children (the actual form input) */
  children: React.ReactNode;
  /** Optional help text */
  helpText?: string;
}

export function FieldWithProvenance({
  contextPath,
  provenanceMap,
  missingFields,
  label,
  required = false,
  children,
  helpText,
}: FieldWithProvenanceProps) {
  const provenance = provenanceMap.get(contextPath) || null;
  const isMissing = missingFields.includes(contextPath);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-200">
        {label}
        {required && <span className="text-amber-400 ml-1">*</span>}
      </label>

      {children}

      {helpText && (
        <p className="text-[11px] text-slate-500">{helpText}</p>
      )}

      <ProvenanceHint provenance={provenance} isMissing={isMissing} />
    </div>
  );
}

export default ProvenanceHint;
