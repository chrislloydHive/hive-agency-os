'use client';

import { useEffect, useRef } from 'react';
import { trackEvent } from '@/lib/analytics';

interface GapCompletionTrackerProps {
  website: string;
  marketing_readiness?: number;
  brand_score?: number;
  content_score?: number;
  seo_score?: number;
  website_score?: number;
  authority_score?: number;
}

export function GapCompletionTracker({
  website,
  marketing_readiness,
  brand_score,
  content_score,
  seo_score,
  website_score,
  authority_score,
}: GapCompletionTrackerProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only fire once per component mount
    if (!hasTracked.current) {
      trackEvent('gap_completed', {
        website,
        marketing_readiness,
        brand_score,
        content_score,
        seo_score,
        website_score,
        authority_score,
      });
      hasTracked.current = true;
    }
  }, [website, marketing_readiness, brand_score, content_score, seo_score, website_score, authority_score]);

  // This component doesn't render anything
  return null;
}
