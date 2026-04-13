// app/tasks/summary/page.tsx
// Global Daily Summary — no companyId required, uses default Hive Agency company

import { SummaryClient } from '../../c/[companyId]/tasks/summary/SummaryClient';

export const dynamic = 'force-dynamic';

const DEFAULT_COMPANY_ID = process.env.DMA_DEFAULT_COMPANY_ID || 'recWofrWdHQOwDIBP';

export const metadata = {
  title: 'Daily Summary | Hive OS',
  description: 'Daily task summary — overdue, hot, and due today',
};

export default function GlobalSummaryPage() {
  return (
    <SummaryClient
      companyId={DEFAULT_COMPANY_ID}
      companyName="Hive Agency"
      backUrl="/tasks"
    />
  );
}
