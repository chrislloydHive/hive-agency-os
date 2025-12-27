'use client';

// components/settings/FirmBrainSection.tsx
// Firm Brain Settings Section - Hub for agency knowledge base

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  Star,
  DollarSign,
  Calendar,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { FirmBrainHealth } from '@/lib/types/firmBrain';

interface FirmBrainItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  count: number | null;
  status: 'empty' | 'partial' | 'complete';
}

export function FirmBrainSection() {
  const [health, setHealth] = useState<FirmBrainHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const response = await fetch('/api/settings/firm-brain/health');
        if (response.ok) {
          const data = await response.json();
          setHealth(data);
        } else {
          setError('Failed to load Firm Brain status');
        }
      } catch (err) {
        console.error('Failed to fetch Firm Brain health:', err);
        setError('Failed to load Firm Brain status');
      } finally {
        setLoading(false);
      }
    }
    fetchHealth();
  }, []);

  const items: FirmBrainItem[] = [
    {
      id: 'agency-profile',
      label: 'Agency Profile',
      description: 'Company info, services, differentiators',
      href: '/settings/firm-brain/agency',
      icon: <Building2 className="w-4 h-4" />,
      count: null,
      status: health?.hasAgencyProfile ? 'complete' : 'empty',
    },
    {
      id: 'team-members',
      label: 'Team Members',
      description: 'Staff profiles and expertise',
      href: '/settings/firm-brain/team',
      icon: <Users className="w-4 h-4" />,
      count: health?.teamMemberCount ?? 0,
      status: (health?.teamMemberCount ?? 0) >= 3 ? 'complete' : (health?.teamMemberCount ?? 0) > 0 ? 'partial' : 'empty',
    },
    {
      id: 'case-studies',
      label: 'Case Studies',
      description: 'Portfolio work and outcomes',
      href: '/settings/firm-brain/case-studies',
      icon: <Briefcase className="w-4 h-4" />,
      count: health?.caseStudyCount ?? 0,
      status: (health?.caseStudyCount ?? 0) >= 3 ? 'complete' : (health?.caseStudyCount ?? 0) > 0 ? 'partial' : 'empty',
    },
    {
      id: 'references',
      label: 'Client References',
      description: 'Testimonials and contacts',
      href: '/settings/firm-brain/references',
      icon: <Star className="w-4 h-4" />,
      count: health?.referenceCount ?? 0,
      status: (health?.referenceCount ?? 0) >= 2 ? 'complete' : (health?.referenceCount ?? 0) > 0 ? 'partial' : 'empty',
    },
    {
      id: 'pricing-templates',
      label: 'Pricing Templates',
      description: 'Reusable pricing structures',
      href: '/settings/firm-brain/pricing',
      icon: <DollarSign className="w-4 h-4" />,
      count: health?.pricingTemplateCount ?? 0,
      status: (health?.pricingTemplateCount ?? 0) > 0 ? 'complete' : 'empty',
    },
    {
      id: 'plan-templates',
      label: 'Plan Templates',
      description: 'Project phases and timelines',
      href: '/settings/firm-brain/plans',
      icon: <Calendar className="w-4 h-4" />,
      count: health?.planTemplateCount ?? 0,
      status: (health?.planTemplateCount ?? 0) > 0 ? 'complete' : 'empty',
    },
  ];

  if (loading) {
    return (
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Firm Brain</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      </section>
    );
  }

  const completedCount = items.filter(i => i.status === 'complete').length;
  const isReadyForRfp = health?.readyForRfp ?? false;

  return (
    <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Firm Brain</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Agency knowledge base for RFP responses
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isReadyForRfp ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              RFP Ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full">
              <AlertCircle className="w-3 h-3" />
              {completedCount}/{items.length} complete
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex items-center gap-3 p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-lg transition-all"
          >
            <div className={`p-2 rounded-lg ${getStatusBg(item.status)}`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200 group-hover:text-white">
                  {item.label}
                </span>
                {item.count !== null && item.count > 0 && (
                  <span className="text-xs text-slate-500">({item.count})</span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate">{item.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-400 flex-shrink-0" />
          </Link>
        ))}
      </div>

      {!isReadyForRfp && health?.missingForRfp && health.missingForRfp.length > 0 && (
        <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-400">
            <strong>To unlock RFP generation:</strong> {health.missingForRfp.join(', ')}
          </p>
        </div>
      )}
    </section>
  );
}

function getStatusBg(status: 'empty' | 'partial' | 'complete'): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-500/10 text-emerald-400';
    case 'partial':
      return 'bg-amber-500/10 text-amber-400';
    default:
      return 'bg-slate-700 text-slate-400';
  }
}

export default FirmBrainSection;
