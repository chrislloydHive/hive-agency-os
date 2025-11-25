'use client';

// components/os/CompanyHealthBadge.tsx
// Health indicator badge for company display

import type { CompanyHealth } from '@/lib/os/types';

interface CompanyHealthBadgeProps {
  health: CompanyHealth;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const healthConfig: Record<
  CompanyHealth,
  { label: string; color: string; bg: string; border: string; dot: string }
> = {
  healthy: {
    label: 'Healthy',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  'at-risk': {
    label: 'At Risk',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
  },
  unknown: {
    label: 'Unknown',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    dot: 'bg-slate-500',
  },
};

export function CompanyHealthBadge({
  health,
  showLabel = true,
  size = 'sm',
}: CompanyHealthBadgeProps) {
  const config = healthConfig[health];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-sm',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-medium border ${config.bg} ${config.border} ${config.color} ${sizeClasses[size]}`}
      title={`Company health: ${config.label}`}
    >
      <span className={`${dotSizes[size]} rounded-full ${config.dot}`} />
      {showLabel && config.label}
    </span>
  );
}

// Utility function to calculate company health based on various factors
interface HealthFactors {
  daysSinceLastAssessment?: number;
  overallScore?: number;
  hasActivePlan?: boolean;
  overdueWorkItems?: number;
  atRiskIndicators?: string[];
}

export function calculateCompanyHealth(factors: HealthFactors): CompanyHealth {
  const {
    daysSinceLastAssessment,
    overallScore,
    hasActivePlan,
    overdueWorkItems = 0,
    atRiskIndicators = [],
  } = factors;

  // Critical conditions
  if (atRiskIndicators.length >= 3) return 'critical';
  if (overallScore !== undefined && overallScore < 40) return 'critical';
  if (overdueWorkItems >= 5) return 'critical';

  // At-risk conditions
  if (atRiskIndicators.length >= 1) return 'at-risk';
  if (daysSinceLastAssessment !== undefined && daysSinceLastAssessment > 90) return 'at-risk';
  if (overallScore !== undefined && overallScore < 60) return 'at-risk';
  if (!hasActivePlan) return 'at-risk';
  if (overdueWorkItems >= 2) return 'at-risk';

  // Healthy if no concerning factors
  if (overallScore !== undefined && overallScore >= 70) return 'healthy';
  if (hasActivePlan && overdueWorkItems === 0) return 'healthy';

  return 'unknown';
}

// Health Summary component for expanded view
interface CompanyHealthSummaryProps {
  health: CompanyHealth;
  factors: HealthFactors;
}

export function CompanyHealthSummary({ health, factors }: CompanyHealthSummaryProps) {
  const config = healthConfig[health];

  const issues: string[] = [];

  if (factors.daysSinceLastAssessment && factors.daysSinceLastAssessment > 90) {
    issues.push(`Last assessment was ${factors.daysSinceLastAssessment} days ago`);
  }
  if (factors.overallScore !== undefined && factors.overallScore < 60) {
    issues.push(`Overall score is ${factors.overallScore}/100`);
  }
  if (!factors.hasActivePlan) {
    issues.push('No active growth plan');
  }
  if (factors.overdueWorkItems && factors.overdueWorkItems > 0) {
    issues.push(`${factors.overdueWorkItems} overdue work items`);
  }
  if (factors.atRiskIndicators && factors.atRiskIndicators.length > 0) {
    issues.push(...factors.atRiskIndicators);
  }

  return (
    <div className={`rounded-lg p-4 ${config.bg} border ${config.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-3 h-3 rounded-full ${config.dot}`} />
        <span className={`font-medium ${config.color}`}>{config.label}</span>
      </div>
      {issues.length > 0 ? (
        <ul className="text-sm text-slate-400 space-y-1">
          {issues.map((issue, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-slate-600">•</span>
              {issue}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400">
          No issues detected. Company is in good standing.
        </p>
      )}
    </div>
  );
}
