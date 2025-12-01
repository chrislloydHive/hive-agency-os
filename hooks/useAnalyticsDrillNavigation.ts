// hooks/useAnalyticsDrillNavigation.ts
// Navigation helper for analytics drill-through interactions
//
// Provides functions to navigate between analytics tabs and scroll to specific sections.
// Uses query params to highlight/scroll to specific sections after navigation.
// Supports activity timeline filtering via activityType query param.

'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';

type AnalyticsSection = 'overview' | 'charts' | 'traffic' | 'search';

// Activity types that can be used to filter the timeline
export type ActivityFilterType =
  | 'dma_audit'
  | 'gap_ia'
  | 'gap_full'
  | 'gap_review_cta'
  | 'work_item'
  | 'experiment'
  | 'diagnostic'
  | 'report'
  | 'insight';

interface UseAnalyticsDrillNavigationOptions {
  companyId?: string;
  onSectionChange?: (section: AnalyticsSection) => void;
  onActivityFilterChange?: (filterType: ActivityFilterType | null) => void;
}

export function useAnalyticsDrillNavigation(
  options: UseAnalyticsDrillNavigationOptions = {}
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { companyId, onSectionChange, onActivityFilterChange } = options;

  // Check for highlight param and scroll to element
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (highlight) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const element = document.getElementById(highlight);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add temporary highlight effect
          element.classList.add('ring-2', 'ring-amber-500/50');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-amber-500/50');
          }, 2000);
        }
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete('highlight');
        router.replace(url.pathname + url.search, { scroll: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  // Check for activityType param and notify parent
  useEffect(() => {
    const activityType = searchParams.get('activityType') as ActivityFilterType | null;
    if (activityType && onActivityFilterChange) {
      onActivityFilterChange(activityType);
      // Clean up URL after processing
      const url = new URL(window.location.href);
      url.searchParams.delete('activityType');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router, onActivityFilterChange]);

  // Navigate to company charts tab
  const goToCompanyCharts = useCallback(
    (targetCompanyId?: string, sectionId?: string) => {
      const cid = targetCompanyId || companyId;
      if (!cid) {
        console.warn('No companyId provided for navigation');
        return;
      }

      // If we're already on the company page, just change the section
      if (pathname?.includes(`/c/${cid}`)) {
        onSectionChange?.('charts');
        if (sectionId) {
          setTimeout(() => {
            const element = document.getElementById(sectionId);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      } else {
        // Navigate to company page with section param
        const url = `/c/${cid}?tab=analytics&section=charts${sectionId ? `&highlight=${sectionId}` : ''}`;
        router.push(url);
      }
    },
    [companyId, pathname, router, onSectionChange]
  );

  // Navigate to company search tab
  const goToCompanySearch = useCallback(
    (targetCompanyId?: string, sectionId?: string) => {
      const cid = targetCompanyId || companyId;
      if (!cid) {
        console.warn('No companyId provided for navigation');
        return;
      }

      if (pathname?.includes(`/c/${cid}`)) {
        onSectionChange?.('search');
        if (sectionId) {
          setTimeout(() => {
            const element = document.getElementById(sectionId);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      } else {
        const url = `/c/${cid}?tab=analytics&section=search${sectionId ? `&highlight=${sectionId}` : ''}`;
        router.push(url);
      }
    },
    [companyId, pathname, router, onSectionChange]
  );

  // Navigate to company traffic tab
  const goToCompanyTraffic = useCallback(
    (targetCompanyId?: string, sectionId?: string) => {
      const cid = targetCompanyId || companyId;
      if (!cid) {
        console.warn('No companyId provided for navigation');
        return;
      }

      if (pathname?.includes(`/c/${cid}`)) {
        onSectionChange?.('traffic');
        if (sectionId) {
          setTimeout(() => {
            const element = document.getElementById(sectionId);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      } else {
        const url = `/c/${cid}?tab=analytics&section=traffic${sectionId ? `&highlight=${sectionId}` : ''}`;
        router.push(url);
      }
    },
    [companyId, pathname, router, onSectionChange]
  );

  // Navigate to company overview/activity with optional filter
  const goToCompanyActivity = useCallback(
    (targetCompanyId?: string, activityType?: ActivityFilterType) => {
      const cid = targetCompanyId || companyId;
      if (!cid) {
        console.warn('No companyId provided for navigation');
        return;
      }

      if (pathname?.includes(`/c/${cid}`)) {
        onSectionChange?.('overview');
        // Apply filter if provided
        if (activityType && onActivityFilterChange) {
          onActivityFilterChange(activityType);
        }
        setTimeout(() => {
          const element = document.getElementById('activity-timeline');
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      } else {
        const baseUrl = `/c/${cid}?tab=analytics&section=overview&highlight=activity-timeline`;
        const url = activityType ? `${baseUrl}&activityType=${activityType}` : baseUrl;
        router.push(url);
      }
    },
    [companyId, pathname, router, onSectionChange, onActivityFilterChange]
  );

  // Navigate to company analytics page
  const goToCompanyAnalytics = useCallback(
    (targetCompanyId: string) => {
      router.push(`/c/${targetCompanyId}`);
    },
    [router]
  );

  // Open external URL in new tab
  const openExternalUrl = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Scroll to element on current page
  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return {
    goToCompanyCharts,
    goToCompanySearch,
    goToCompanyTraffic,
    goToCompanyActivity,
    goToCompanyAnalytics,
    openExternalUrl,
    scrollToSection,
  };
}
