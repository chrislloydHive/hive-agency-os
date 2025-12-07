// app/c/[companyId]/brain/labs/page.tsx
// Labs Hub - Deep-dive diagnostics hub under Brain
// Canonical route: /c/[companyId]/brain/labs

import Link from 'next/link';
import { Swords, Globe, Palette, FlaskConical, Users, TrendingUp } from 'lucide-react';
import { LABS } from '@/lib/nav/companyNav';

interface Props {
  params: Promise<{ companyId: string }>;
}

interface LabCardDisplay {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  href: string;
  status: 'active' | 'coming_soon';
  gradient: string;
  iconColor: string;
}

// Icon mapping for labs
const labIcons: Record<string, React.ElementType> = {
  competition: Swords,
  creative: Palette,
  competitor: TrendingUp,
  website: Globe,
  brand: FlaskConical,
  audience: Users,
};

// Gradient mapping for labs
const labGradients: Record<string, { gradient: string; iconColor: string }> = {
  competition: { gradient: 'from-rose-500/20 to-amber-500/20', iconColor: 'text-rose-400' },
  creative: { gradient: 'from-violet-500/20 to-pink-500/20', iconColor: 'text-violet-400' },
  competitor: { gradient: 'from-cyan-500/20 to-blue-500/20', iconColor: 'text-cyan-400' },
  website: { gradient: 'from-emerald-500/20 to-teal-500/20', iconColor: 'text-emerald-400' },
  brand: { gradient: 'from-amber-500/20 to-orange-500/20', iconColor: 'text-amber-400' },
  audience: { gradient: 'from-blue-500/20 to-indigo-500/20', iconColor: 'text-blue-400' },
};

export default async function LabsHubPage({ params }: Props) {
  const { companyId } = await params;

  // Build display labs from centralized LABS config
  const labs: LabCardDisplay[] = LABS.map((lab) => ({
    id: lab.id,
    name: lab.name,
    description: lab.description,
    icon: labIcons[lab.id] || FlaskConical,
    href: lab.href(companyId),
    status: lab.status,
    gradient: labGradients[lab.id]?.gradient || 'from-slate-500/20 to-slate-600/20',
    iconColor: labGradients[lab.id]?.iconColor || 'text-slate-400',
  }));

  const activeLabs = labs.filter(l => l.status === 'active');
  const comingSoonLabs = labs.filter(l => l.status === 'coming_soon');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-slate-500 mb-1">Brain &rarr; Labs</p>
        <h2 className="text-lg font-semibold text-slate-100">Labs</h2>
        <p className="text-sm text-slate-400 mt-1">
          Deep-dive diagnostics that refine company context and feed strategy, work, and QBR.
        </p>
      </div>

      {/* Active Labs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {activeLabs.map((lab) => {
          const Icon = lab.icon;
          return (
            <Link
              key={lab.id}
              href={lab.href}
              className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition-all hover:border-slate-700 hover:bg-slate-900/80"
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${lab.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

              <div className="relative">
                <div className={`inline-flex p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 mb-3 ${lab.iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-100 mb-1.5 group-hover:text-white transition-colors">
                  {lab.name}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {lab.description}
                </p>
              </div>

              <div className="relative mt-4 pt-3 border-t border-slate-800/50">
                <span className="text-xs font-medium text-amber-400 group-hover:text-amber-300 transition-colors flex items-center gap-1">
                  Open Lab
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Coming Soon Labs */}
      {comingSoonLabs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-500 mb-3">Coming Soon</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {comingSoonLabs.map((lab) => {
              const Icon = lab.icon;
              return (
                <div
                  key={lab.id}
                  className="relative flex flex-col justify-between rounded-xl border border-slate-800/50 bg-slate-900/30 p-5 opacity-60"
                >
                  <div>
                    <div className={`inline-flex p-2.5 rounded-lg bg-slate-800/30 border border-slate-800/50 mb-3 text-slate-500`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-300 mb-1.5">
                      {lab.name}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {lab.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/30">
                    <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                      Coming Soon
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
