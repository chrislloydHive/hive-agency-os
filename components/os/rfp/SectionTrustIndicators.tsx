'use client';

// components/os/rfp/SectionTrustIndicators.tsx
// Shows what inputs were used to generate a section

import { Check, X, Building2, Users, Briefcase, Star, DollarSign, Calendar } from 'lucide-react';
import type { GeneratedUsing } from '@/lib/types/rfp';

interface SectionTrustIndicatorsProps {
  generatedUsing: GeneratedUsing | null;
  /** Compact mode shows fewer indicators */
  compact?: boolean;
}

interface InputIndicator {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  used: boolean;
}

export function SectionTrustIndicators({
  generatedUsing,
  compact = false,
}: SectionTrustIndicatorsProps) {
  if (!generatedUsing?.inputsUsed) {
    return null;
  }

  const { inputsUsed } = generatedUsing;

  const indicators: InputIndicator[] = [
    {
      key: 'agencyProfile',
      label: 'Agency Profile',
      shortLabel: 'Profile',
      icon: <Building2 className="w-3 h-3" />,
      used: inputsUsed.agencyProfile,
    },
    {
      key: 'team',
      label: 'Team Members',
      shortLabel: 'Team',
      icon: <Users className="w-3 h-3" />,
      used: inputsUsed.team,
    },
    {
      key: 'caseStudies',
      label: 'Case Studies',
      shortLabel: 'Cases',
      icon: <Briefcase className="w-3 h-3" />,
      used: inputsUsed.caseStudies,
    },
    {
      key: 'references',
      label: 'References',
      shortLabel: 'Refs',
      icon: <Star className="w-3 h-3" />,
      used: inputsUsed.references,
    },
    {
      key: 'pricing',
      label: 'Pricing Template',
      shortLabel: 'Pricing',
      icon: <DollarSign className="w-3 h-3" />,
      used: inputsUsed.pricing,
    },
    {
      key: 'plans',
      label: 'Plan Template',
      shortLabel: 'Plans',
      icon: <Calendar className="w-3 h-3" />,
      used: inputsUsed.plans,
    },
  ];

  // In compact mode, only show used inputs
  const displayIndicators = compact
    ? indicators.filter(i => i.used)
    : indicators;

  if (displayIndicators.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayIndicators.map((indicator) => (
        <span
          key={indicator.key}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
            indicator.used
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-slate-700/50 text-slate-500'
          }`}
          title={indicator.label}
        >
          {indicator.icon}
          {compact ? null : (
            <>
              <span>{indicator.shortLabel}</span>
              {indicator.used ? (
                <Check className="w-2.5 h-2.5" />
              ) : (
                <X className="w-2.5 h-2.5" />
              )}
            </>
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Minimal indicator for section list items
 */
export function SectionTrustBadge({
  generatedUsing,
}: {
  generatedUsing: GeneratedUsing | null;
}) {
  if (!generatedUsing?.inputsUsed) {
    return null;
  }

  const { inputsUsed } = generatedUsing;
  const usedCount = Object.values(inputsUsed).filter(Boolean).length;
  const totalCount = Object.keys(inputsUsed).length;

  if (usedCount === 0) {
    return null;
  }

  // Simple badge showing how many inputs were used
  return (
    <span
      className={`text-[10px] px-1 py-0.5 rounded ${
        usedCount >= 4 ? 'bg-emerald-500/10 text-emerald-400' :
        usedCount >= 2 ? 'bg-blue-500/10 text-blue-400' :
        'bg-slate-700/50 text-slate-400'
      }`}
      title={`${usedCount}/${totalCount} inputs used`}
    >
      FB {usedCount}/{totalCount}
    </span>
  );
}

/**
 * Text summary of inputs used
 */
export function getInputsSummary(generatedUsing: GeneratedUsing | null): string {
  if (!generatedUsing?.inputsUsed) {
    return 'No input tracking';
  }

  const { inputsUsed } = generatedUsing;
  const used: string[] = [];

  if (inputsUsed.agencyProfile) used.push('Profile');
  if (inputsUsed.team) used.push('Team');
  if (inputsUsed.caseStudies) used.push('Cases');
  if (inputsUsed.references) used.push('Refs');
  if (inputsUsed.pricing) used.push('Pricing');
  if (inputsUsed.plans) used.push('Plans');

  if (used.length === 0) {
    return 'No Firm Brain inputs';
  }

  return `Used: ${used.join(', ')}`;
}
