// app/c/[companyId]/reports/layout.tsx
// Reports workspace layout
//
// Clean header-only layout. Navigation is handled by tabs within the page.

import { FileText } from 'lucide-react';

interface ReportsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}

export default async function ReportsLayout({ children, params }: ReportsLayoutProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* Reports Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl">
          <FileText className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-500">
            All strategic documents, narratives, and diagnostics for this company.
          </p>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
