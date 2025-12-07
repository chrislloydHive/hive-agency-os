// app/c/[companyId]/qbr/history/page.tsx
// QBR History - Past QBR runs and exports

import { Metadata } from 'next';
import { History, FileText, Download, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'History - QBR',
};

interface PageProps {
  params: Promise<{ companyId: string }>;
}

export default async function QbrHistoryPage({ params }: PageProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-slate-500 mb-1">QBR &rarr; History</p>
        <h2 className="text-lg font-semibold text-slate-100">QBR History</h2>
        <p className="text-sm text-slate-400 mt-1">
          View past QBR runs, compare across quarters, and export reports.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
            <History className="w-8 h-8 text-purple-400" />
          </div>

          <h2 className="text-xl font-semibold text-slate-100 mb-3">
            QBR History Coming Soon
          </h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Access past quarterly business reviews, track strategic evolution,
            and export presentation-ready reports.
          </p>

          <div className="w-full space-y-3">
            <HistoryPreview
              quarter="Q3 2024"
              date="Oct 15, 2024"
              status="completed"
            />
            <HistoryPreview
              quarter="Q2 2024"
              date="Jul 12, 2024"
              status="completed"
            />
            <HistoryPreview
              quarter="Q1 2024"
              date="Apr 10, 2024"
              status="completed"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPreview({
  quarter,
  date,
  status,
}: {
  quarter: string;
  date: string;
  status: 'completed' | 'draft';
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-left">
      <div className="flex items-center gap-3">
        <FileText className="w-4 h-4 text-slate-500" />
        <div>
          <div className="text-sm font-medium text-slate-200">{quarter}</div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3" />
            {date}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs ${
          status === 'completed'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }`}>
          {status === 'completed' ? 'Completed' : 'Draft'}
        </span>
        <button className="p-1.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
