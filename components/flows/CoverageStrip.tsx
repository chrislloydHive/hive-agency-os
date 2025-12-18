// components/flows/CoverageStrip.tsx
// Domain coverage strip for flow readiness
//
// Simple horizontal strip showing domain readiness status:
// [Identity ✓] [Brand ✓] [Website ⚠] [SEO ○]
//
// Legend:
// ✓ = covered (green)
// ⚠ = recommended missing (amber)
// ○ = critical missing (red)

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  checkFlowReadinessFromGraph,
  type FlowType,
  type FlowReadiness,
} from '@/lib/os/flow/readiness.shared';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

interface CoverageStripProps {
  graph: CompanyContextGraph | null;
  companyId: string;
  flowType: FlowType;
  className?: string;
  showLabels?: boolean;
}

interface DomainStatus {
  domain: string;
  label: string;
  status: 'covered' | 'recommended_missing' | 'critical_missing';
  labHref?: string;
  labName?: string;
}

export function CoverageStrip({
  graph,
  companyId,
  flowType,
  className = '',
  showLabels = true,
}: CoverageStripProps) {
  const { readiness, domainStatuses } = useMemo(() => {
    if (!graph) {
      return { readiness: null, domainStatuses: [] };
    }

    const readiness = checkFlowReadinessFromGraph(graph, flowType, companyId);
    const statuses: DomainStatus[] = [];

    // Build status for each domain in requirements
    for (const req of readiness.requirements) {
      let status: DomainStatus['status'] = 'covered';

      if (!req.present) {
        if (readiness.missingCritical.some(r => r.domain === req.domain)) {
          status = 'critical_missing';
        } else if (readiness.missingRecommended.some(r => r.domain === req.domain)) {
          status = 'recommended_missing';
        }
      }

      // Find lab CTA for this domain
      const labCta = readiness.labCTAs.find(cta => cta.domain === req.domain);

      statuses.push({
        domain: req.domain,
        label: req.label,
        status,
        labHref: labCta?.href,
        labName: labCta?.labName,
      });
    }

    return { readiness, domainStatuses: statuses };
  }, [graph, companyId, flowType]);

  if (!graph || domainStatuses.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {domainStatuses.map((domain) => (
        <DomainChip
          key={domain.domain}
          domain={domain}
          showLabel={showLabels}
        />
      ))}

      {/* Summary indicator */}
      <div className="ml-2 text-xs text-slate-500">
        {readiness?.isReady ? (
          <span className="text-emerald-500">Ready</span>
        ) : (
          <span className="text-amber-500">
            {readiness?.missingCritical.length || 0} critical missing
          </span>
        )}
      </div>
    </div>
  );
}

function DomainChip({
  domain,
  showLabel,
}: {
  domain: DomainStatus;
  showLabel: boolean;
}) {
  const statusConfig = {
    covered: {
      icon: '✓',
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    recommended_missing: {
      icon: '⚠',
      bg: 'bg-amber-500/20',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    critical_missing: {
      icon: '○',
      bg: 'bg-red-500/20',
      text: 'text-red-400',
      border: 'border-red-500/30',
    },
  };

  const config = statusConfig[domain.status];

  const chipContent = (
    <div
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
        border ${config.bg} ${config.text} ${config.border}
        transition-colors
        ${domain.labHref && domain.status !== 'covered' ? 'hover:opacity-80 cursor-pointer' : ''}
      `}
      title={
        domain.status === 'covered'
          ? `${domain.label}: Data present`
          : domain.labName
          ? `${domain.label}: Run ${domain.labName} to populate`
          : `${domain.label}: Missing data`
      }
    >
      <span>{config.icon}</span>
      {showLabel && <span>{domain.label}</span>}
    </div>
  );

  // Wrap in Link if there's a lab CTA and domain is missing
  if (domain.labHref && domain.status !== 'covered') {
    return (
      <Link href={domain.labHref}>
        {chipContent}
      </Link>
    );
  }

  return chipContent;
}

// Compact version for inline use
export function CoverageStripCompact({
  graph,
  companyId,
  flowType,
  className = '',
}: Omit<CoverageStripProps, 'showLabels'>) {
  return (
    <CoverageStrip
      graph={graph}
      companyId={companyId}
      flowType={flowType}
      className={className}
      showLabels={false}
    />
  );
}
