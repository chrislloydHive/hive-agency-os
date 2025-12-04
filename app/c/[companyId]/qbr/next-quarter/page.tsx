// app/c/[companyId]/qbr/next-quarter/page.tsx
// QBR Next Quarter Planning Page - Placeholder

import { Metadata } from 'next';
import { Calendar, ArrowRight, Sparkles, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Next Quarter - QBR',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QbrNextQuarterPage({ params }: PageProps) {
  const { companyId } = await params;

  // Calculate next quarter
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  const nextQuarter = currentQuarter === 4 ? 1 : currentQuarter + 1;
  const nextYear = currentQuarter === 4 ? now.getFullYear() + 1 : now.getFullYear();

  return (
    <div className="space-y-6">
      {/* Coming Soon Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mb-6">
            <Calendar className="w-8 h-8 text-cyan-400" />
          </div>

          <h2 className="text-xl font-semibold text-slate-100 mb-3">
            Q{nextQuarter} {nextYear} Planning Coming Soon
          </h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Plan and prepare for the upcoming quarter. Set objectives, allocate resources, and define success criteria.
          </p>

          <div className="w-full space-y-3">
            <PlanningStep
              step={1}
              title="Review current quarter performance"
              description="Analyze KPIs and identify learnings"
              icon={<FileText className="w-4 h-4" />}
            />
            <PlanningStep
              step={2}
              title="Update strategic priorities"
              description="Adjust based on market conditions"
              icon={<ArrowRight className="w-4 h-4" />}
            />
            <PlanningStep
              step={3}
              title="Generate AI recommendations"
              description="Get data-driven suggestions"
              icon={<Sparkles className="w-4 h-4" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanningStep({
  step,
  title,
  description,
  icon,
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-left">
      <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 text-cyan-400">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-200">
          Step {step}: {title}
        </div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </div>
  );
}
