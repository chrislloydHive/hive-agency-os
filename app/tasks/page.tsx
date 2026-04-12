// app/tasks/page.tsx
// My Tasks — Top-level task tracker for Hive team
//
// Views:
// - Inbox: Gmail-sourced tasks for triage
// - Brain Dump: Quick-capture ideas and todos
// - Projects: Grouped by project/client
// - Archive: Completed/dismissed items

import { TasksClient } from '../c/[companyId]/tasks/TasksClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Tasks | Hive OS',
  description: 'Hive Task Tracker — inbox triage, brain dump, projects, and archive',
};

export default function MyTasksPage() {
  return <TasksClient />;
}
