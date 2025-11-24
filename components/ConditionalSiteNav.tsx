'use client';

import { usePathname } from 'next/navigation';
import SiteNav from './SiteNav';

/**
 * Wrapper component that conditionally renders SiteNav
 * Hides the marketing site navigation when on /os routes
 * since /os has its own sidebar navigation
 */
export default function ConditionalSiteNav() {
  const pathname = usePathname();

  // Hide SiteNav on /os routes (they have their own sidebar)
  if (pathname.startsWith('/os')) {
    return null;
  }

  return <SiteNav />;
}
