'use client';

// app/c/[companyId]/briefs/[briefId]/BriefWorkspaceClient.tsx
// Client wrapper for BriefWorkspace with refresh capability

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BriefWorkspace } from '@/components/os/briefs/BriefWorkspace';
import type { Brief } from '@/lib/types/brief';

interface BriefWorkspaceClientProps {
  companyId: string;
  initialBrief: Brief;
}

export function BriefWorkspaceClient({ companyId, initialBrief }: BriefWorkspaceClientProps) {
  const router = useRouter();
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Fetch updated brief from API
      const response = await fetch(`/api/os/companies/${companyId}/briefs/${brief.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.brief) {
          setBrief(data.brief);
        }
      }
    } catch (error) {
      console.error('Failed to refresh brief:', error);
    } finally {
      setIsRefreshing(false);
    }

    // Also trigger Next.js router refresh for any server components
    router.refresh();
  }, [companyId, brief.id, router]);

  return (
    <BriefWorkspace
      companyId={companyId}
      brief={brief}
      onRefresh={handleRefresh}
    />
  );
}
