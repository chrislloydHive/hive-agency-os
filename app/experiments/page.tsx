// app/experiments/page.tsx
// Global experiments page - shows all experiments across all companies

import { ExperimentsClient } from '@/components/experiments/ExperimentsClient';

export const metadata = {
  title: 'Experiments | Hive OS',
  description: 'Track A/B tests, hypotheses, and growth experiments',
};

export default function ExperimentsPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <ExperimentsClient
          showCompanyColumn={true}
          title="All Experiments"
          description="Track A/B tests, hypotheses, and growth experiments across all companies"
        />
      </div>
    </div>
  );
}
