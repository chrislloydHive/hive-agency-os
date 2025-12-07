// app/c/[companyId]/reports/layout.tsx
// Reports workspace layout with sub-navigation
//
// Reports tabs:
// - All Reports: Dashboard with report types
// - Annual Plan: Yearly strategic plan
// - QBR: Quarterly business review
// - Diagnostics: GAP analyses, lab runs, diagnostic reports

import { FileText } from 'lucide-react';
import { ReportsSubNav } from '@/components/os/ReportsSubNav';

interface ReportsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}

export default async function ReportsLayout({ children, params }: ReportsLayoutProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* Reports Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Reports</h1>
            <p className="text-sm text-slate-500">Strategic documents & diagnostics</p>
          </div>
        </div>

        {/* Sub-navigation */}
        <ReportsSubNav companyId={companyId} />
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
