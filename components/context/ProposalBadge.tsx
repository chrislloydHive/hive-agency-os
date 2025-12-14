// components/context/ProposalBadge.tsx
// Proposal Badge Component
//
// Shows a small indicator that a field has a pending AI proposal

'use client';

import { Sparkles } from 'lucide-react';

interface ProposalBadgeProps {
  confidence: number;
  onClick?: () => void;
  className?: string;
}

export function ProposalBadge({ confidence, onClick, className = '' }: ProposalBadgeProps) {
  const confidencePercent = Math.round(confidence * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors ${className}`}
    >
      <Sparkles className="h-2.5 w-2.5" />
      <span>AI Proposal</span>
      {confidence > 0 && (
        <span className="opacity-75">{confidencePercent}%</span>
      )}
    </button>
  );
}
