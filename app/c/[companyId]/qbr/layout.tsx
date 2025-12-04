// app/c/[companyId]/qbr/layout.tsx
// QBR workspace layout with sub-navigation

import { BarChart3 } from 'lucide-react';
import { QbrSubNav } from '@/components/os/QbrSubNav';

interface QbrLayoutProps {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}

export default async function QbrLayout({ children, params }: QbrLayoutProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* QBR Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Quarterly Business Review</h1>
            <p className="text-sm text-slate-500">Strategic planning & performance review</p>
          </div>
        </div>

        {/* Sub-navigation */}
        <QbrSubNav companyId={companyId} />
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
