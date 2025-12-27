'use client';

// app/settings/firm-brain/page.tsx
// Firm Brain Settings Index - overview of all sections

import Link from 'next/link';
import {
  Building2,
  Users,
  Briefcase,
  Star,
  DollarSign,
  FileText,
  ChevronRight,
} from 'lucide-react';

const FIRM_BRAIN_SECTIONS = [
  {
    key: 'agency',
    title: 'Agency Profile',
    description: 'Core identity, differentiators, and capabilities',
    icon: Building2,
    href: '/settings/firm-brain/agency',
  },
  {
    key: 'team',
    title: 'Team Members',
    description: 'Staff profiles for proposal team sections',
    icon: Users,
    href: '/settings/firm-brain/team',
  },
  {
    key: 'case-studies',
    title: 'Case Studies',
    description: 'Past work examples and success stories',
    icon: Briefcase,
    href: '/settings/firm-brain/case-studies',
  },
  {
    key: 'references',
    title: 'References',
    description: 'Client references and testimonials',
    icon: Star,
    href: '/settings/firm-brain/references',
  },
  {
    key: 'pricing',
    title: 'Pricing Templates',
    description: 'Standard pricing structures and rate cards',
    icon: DollarSign,
    href: '/settings/firm-brain/pricing',
  },
  {
    key: 'plans',
    title: 'Plan Templates',
    description: 'Reusable plan components and frameworks',
    icon: FileText,
    href: '/settings/firm-brain/plans',
  },
];

export default function FirmBrainIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Firm Brain</h1>
        <p className="text-slate-400 mt-1">
          Your agency&apos;s knowledge base for generating RFP responses and proposals
        </p>
      </div>

      <div className="grid gap-4">
        {FIRM_BRAIN_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.key}
              href={section.href}
              className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 hover:bg-slate-900/70 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Icon className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="font-medium text-white group-hover:text-purple-300 transition-colors">
                    {section.title}
                  </h2>
                  <p className="text-sm text-slate-500">{section.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
            </Link>
          );
        })}
      </div>

      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <p className="text-sm text-amber-300">
          <strong>Tip:</strong> Fill out your Agency Profile first - it&apos;s the foundation for all
          generated content. Then add team members and case studies to make proposals more specific.
        </p>
      </div>
    </div>
  );
}
