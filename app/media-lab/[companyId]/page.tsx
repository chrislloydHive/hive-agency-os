// app/media-lab/[companyId]/page.tsx
// Media Lab V1 - Media planning and channel strategy view

import { getMediaLabForCompany } from '@/lib/media-lab/server';
import { MediaLabView } from '@/components/media-lab/MediaLabView';

type Props = {
  params: Promise<{
    companyId: string;
  }>;
};

export default async function MediaLabPage({ params }: Props) {
  const { companyId } = await params;

  // Fetch media lab data on the server
  const data = await getMediaLabForCompany(companyId);

  return <MediaLabView companyId={companyId} data={data} />;
}
