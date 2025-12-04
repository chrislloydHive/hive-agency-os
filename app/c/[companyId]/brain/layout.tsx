// app/c/[companyId]/brain/layout.tsx
// Brain workspace layout with sub-navigation

import { Brain } from 'lucide-react';
import { BrainSubNav } from '@/components/os/BrainSubNav';

interface BrainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}

export default async function BrainLayout({ children, params }: BrainLayoutProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* Brain Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl">
            <Brain className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Brain</h1>
            <p className="text-sm text-slate-500">Company memory & intelligence</p>
          </div>
        </div>

        {/* Sub-navigation */}
        <BrainSubNav companyId={companyId} />
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
