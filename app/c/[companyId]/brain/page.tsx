// app/c/[companyId]/brain/page.tsx
// Brain index page - redirects to Context by default

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function BrainPage({ params }: PageProps) {
  const { companyId } = await params;

  // Redirect to the default Brain sub-page (Context)
  redirect(`/c/${companyId}/brain/context`);
}
