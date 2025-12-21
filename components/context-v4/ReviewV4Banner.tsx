'use client';

// components/context-v4/ReviewV4Banner.tsx
// Banner CTA for Context V4 review queue
//
// Shows when there are proposed facts awaiting review.
// Fetches count client-side to avoid blocking server render.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { isContextV4Enabled } from '@/lib/types/contextField';

interface ReviewV4BannerProps {
  companyId: string;
  className?: string;
}

export function ReviewV4Banner({ companyId, className = '' }: ReviewV4BannerProps) {
  const [proposedCount, setProposedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip if V4 not enabled (client-side check)
    if (typeof window !== 'undefined' && !isContextV4Enabled()) {
      setLoading(false);
      return;
    }

    async function fetchCount() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4/review?limit=1`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          // V4 not enabled or error
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data.ok) {
          setProposedCount(data.totalCount || 0);
        }
      } catch {
        // Silently fail - V4 might not be enabled
      } finally {
        setLoading(false);
      }
    }

    fetchCount();
  }, [companyId]);

  // Don't render if loading, no proposed, or V4 not enabled
  if (loading || proposedCount === 0) {
    return null;
  }

  return (
    <Link
      href={`/context-v4/${companyId}/review`}
      className={`flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors ${className}`}
    >
      <Sparkles className="w-4 h-4 text-amber-400" />
      <span className="text-sm font-medium text-amber-400">
        Review {proposedCount} {proposedCount === 1 ? 'fact' : 'facts'}
      </span>
    </Link>
  );
}

/**
 * Smaller inline version for tight spaces
 */
export function ReviewV4Badge({ companyId }: { companyId: string }) {
  const [proposedCount, setProposedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCount() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4/review?limit=1`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();
        if (data.ok) {
          setProposedCount(data.totalCount || 0);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchCount();
  }, [companyId]);

  if (loading || proposedCount === 0) {
    return null;
  }

  return (
    <Link
      href={`/context-v4/${companyId}/review`}
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-medium hover:bg-amber-500/20 transition-colors"
    >
      <Sparkles className="w-3 h-3" />
      {proposedCount}
    </Link>
  );
}
