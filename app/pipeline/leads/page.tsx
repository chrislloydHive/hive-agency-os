// app/pipeline/leads/page.tsx
// Redirect to opportunities - leads view has been deprecated

import { redirect } from 'next/navigation';

export default function LeadsPage() {
  redirect('/pipeline/opportunities');
}
