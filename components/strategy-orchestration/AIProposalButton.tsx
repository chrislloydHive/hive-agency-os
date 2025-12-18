'use client';

// components/strategy-orchestration/AIProposalButton.tsx
// AI Proposal Button - Triggers AI proposals for objectives, strategy, or tactics

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { AIProposalAction } from '@/lib/types/strategyOrchestration';

// ============================================================================
// Types
// ============================================================================

interface AIProposalButtonProps {
  action: AIProposalAction;
  companyId: string;
  strategyId?: string;
  onProposalReceived: (proposal: unknown) => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AIProposalButton({
  action,
  companyId,
  strategyId,
  onProposalReceived,
  disabled = false,
  variant = 'primary',
  size = 'md',
  label,
  className = '',
}: AIProposalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLabels: Record<AIProposalAction, string> = {
    propose_objectives: 'Generate Objectives',
    propose_strategy: 'Generate Strategy',
    propose_tactics: 'Generate Tactics',
    improve_field: 'Improve with AI',
  };

  const buttonLabel = label || defaultLabels[action];

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/ai-propose`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            strategyId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate proposal');
      }

      const proposal = await response.json();
      onProposalReceived(proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
    secondary: 'bg-white text-blue-600 border border-blue-600 hover:bg-blue-50 disabled:opacity-50',
    ghost: 'text-blue-600 hover:bg-blue-50 disabled:opacity-50',
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          rounded-md font-medium
          flex items-center gap-1.5
          transition-colors
          disabled:cursor-not-allowed
          ${className}
        `}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {isLoading ? 'Generating...' : buttonLabel}
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

// ============================================================================
// Field Improve Button (specialized for field-level AI)
// ============================================================================

interface FieldImproveButtonProps {
  companyId: string;
  strategyId?: string;
  fieldPath: string;
  currentValue: unknown;
  onImproved: (improvedValue: unknown, rationale: string) => void;
  disabled?: boolean;
  className?: string;
}

export function FieldImproveButton({
  companyId,
  strategyId,
  fieldPath,
  currentValue,
  onImproved,
  disabled = false,
  className = '',
}: FieldImproveButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/strategy/ai-propose`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'improve_field',
            strategyId,
            fieldPath,
            currentValue,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to improve field');
      }

      const data = await response.json();
      if (data.fieldImprovement) {
        onImproved(
          data.fieldImprovement.improvedValue,
          data.fieldImprovement.rationale
        );
      }
    } catch (err) {
      console.error('Field improve error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading || !currentValue}
      className={`
        p-1 text-gray-400 hover:text-blue-600
        disabled:opacity-30 disabled:cursor-not-allowed
        transition-colors
        ${className}
      `}
      title="Improve with AI"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
    </button>
  );
}
