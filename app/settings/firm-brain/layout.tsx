// app/settings/firm-brain/layout.tsx
// Layout for Firm Brain settings pages

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function FirmBrainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Settings
        </Link>
      </div>
      {children}
    </div>
  );
}
