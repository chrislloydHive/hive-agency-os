// app/tasks/command-center/page.tsx
// Chief of Staff AI — Daily Command Center
// Unified, ranked view across Airtable tasks, Google Calendar, and Drive.

import { CommandCenterClient } from './CommandCenterClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Command Center | Hive OS',
  description: 'Chief of Staff AI — what matters today, ranked and linked across systems',
};

export default function CommandCenterPage() {
  // Read at request time (not module load) so Vercel env vars are always current.
  const companyId = process.env.DMA_DEFAULT_COMPANY_ID || 'recWofrWdHQOwDIBP';
  return <CommandCenterClient companyId={companyId} backUrl="/tasks" />;
}
