// app/findings/page.tsx
// Global Findings Dashboard
//
// Cross-company view of all diagnostic findings:
// - Summary strip with total counts by severity, lab, category
// - Filters: time range, severity, lab, category, company, converted
// - Top Companies leaderboard (companies with most critical/high findings)
// - Findings table with detail drawer

import { GlobalFindingsClient } from './GlobalFindingsClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Findings | Hive OS',
  description: 'Global view of diagnostic findings across all companies',
};

export default function GlobalFindingsPage() {
  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <GlobalFindingsClient />
      </div>
    </div>
  );
}
