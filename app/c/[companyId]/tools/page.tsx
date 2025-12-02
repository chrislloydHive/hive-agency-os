// app/c/[companyId]/tools/page.tsx
// REDIRECT: Tools page now redirects to Blueprint
// Tools are now part of the Blueprint strategic hub

import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ToolsPage({ params }: PageProps) {
  const { companyId } = await params;
  redirect(`/c/${companyId}/blueprint`);
}
