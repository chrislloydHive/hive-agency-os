// app/c/[companyId]/setup/layout.tsx
// Full-screen layout for Strategic Setup Mode

import { getCompanyById } from '@/lib/airtable/companies';
import Link from 'next/link';

export default async function SetupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-200 mb-2">Company not found</h2>
          <Link href="/companies" className="text-blue-400 hover:text-blue-300">
            ← Back to companies
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Minimal header for setup mode */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/c/${companyId}`}
              className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm">Exit Setup</span>
            </Link>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Strategic Setup</h1>
              <p className="text-xs text-slate-400">{company.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Auto-saving enabled</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}
