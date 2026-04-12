// app/c/[companyId]/tasks/page.tsx
// My Day — Tasks, Brain Dump, Projects, and Archive
//
// Views:
// - Tasks: Gmail-sourced tasks for triage
// - Brain Dump: Quick-capture ideas and todos
// - Projects: Grouped by project/client
// - Archive: Completed/dismissed items

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { TasksClient } from './TasksClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  return {
    title: `My Day | ${company.name} | Hive OS`,
    description: `My Day for ${company.name} — tasks, brain dump, projects, and archive`,
  };
}

export default async function TasksPage({ params }: PageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  return (
    <TasksClient
      company={{
        id: company.id,
        name: company.name,
      }}
    />
  );
}
