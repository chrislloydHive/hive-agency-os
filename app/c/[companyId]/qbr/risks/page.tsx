// app/c/[companyId]/qbr/risks/page.tsx
// QBR Risks Page - Placeholder

import { Metadata } from 'next';
import { AlertTriangle, ShieldAlert, TrendingDown, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Risks - QBR',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QbrRisksPage({ params }: PageProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* Coming Soon Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>

          <h2 className="text-xl font-semibold text-slate-100 mb-3">
            Risk Assessment Coming Soon
          </h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Identify, assess, and mitigate risks to your quarterly objectives. Track risk status and mitigation progress.
          </p>

          <div className="w-full space-y-3">
            <RiskPreview
              title="Competitive pressure on pricing"
              severity="high"
              category="market"
              icon={<TrendingDown className="w-4 h-4" />}
            />
            <RiskPreview
              title="Key team member leaving"
              severity="medium"
              category="operational"
              icon={<Users className="w-4 h-4" />}
            />
            <RiskPreview
              title="Platform policy changes"
              severity="low"
              category="compliance"
              icon={<ShieldAlert className="w-4 h-4" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskPreview({
  title,
  severity,
  category,
  icon,
}: {
  title: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  icon: React.ReactNode;
}) {
  const severityConfig = {
    high: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'High' },
    medium: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Medium' },
    low: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Low' },
  };

  const config = severityConfig[severity];

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-left">
      <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 ${config.color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200">{title}</div>
        <div className="text-xs text-slate-500 capitalize">{category}</div>
      </div>
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
        {config.label}
      </span>
    </div>
  );
}
