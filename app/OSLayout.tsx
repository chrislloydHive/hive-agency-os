'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import HiveLogo from '@/components/HiveLogo';

interface QuickStats {
  atRiskCount: number;
  workDueToday: number;
  opportunities: number;
}

export function OSLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Fetch quick stats for nav indicators
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/os/dashboard/summary');
        if (response.ok) {
          const data = await response.json();
          setQuickStats({
            atRiskCount: data.clientHealth?.atRisk?.length || 0,
            workDueToday: data.work?.today || 0,
            opportunities: data.pipeline?.activeOpportunities || 0,
          });
        }
      } catch {
        // Silently fail - stats are not critical
      }
    };

    fetchStats();
  }, []);

  // Navigation items
  const navigation = [
    {
      name: 'Dashboard',
      href: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Companies',
      href: '/companies',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      badge: quickStats?.atRiskCount && quickStats.atRiskCount > 0 ? {
        count: quickStats.atRiskCount,
        variant: 'danger' as const,
      } : undefined,
    },
    {
      name: 'Work',
      href: '/work',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      badge: quickStats?.workDueToday && quickStats.workDueToday > 0 ? {
        count: quickStats.workDueToday,
        variant: 'warning' as const,
      } : undefined,
    },
    {
      name: 'Pipeline',
      href: '/pipeline',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      badge: quickStats?.opportunities && quickStats.opportunities > 0 ? {
        count: quickStats.opportunities,
        variant: 'info' as const,
      } : undefined,
      submenu: [
        { name: 'Dashboard', href: '/pipeline' },
        { name: 'Opportunities', href: '/pipeline/opportunities' },
        { name: 'Leads', href: '/pipeline/leads' },
      ],
    },
    {
      name: 'Analytics',
      href: '/analytics/os',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      submenu: [
        { name: 'Overview', href: '/analytics' },
        { name: 'OS Intelligence', href: '/analytics/os' },
        { name: 'DMA Funnel', href: '/analytics/dma' },
        { name: 'Experiments', href: '/analytics/experiments' },
      ],
    },
    {
      name: 'Experiments',
      href: '/experiments',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
    },
  ];

  // Bottom navigation items
  const bottomNavigation = [
    {
      name: 'Tools',
      href: '/tools',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      ),
      submenu: [
        { name: 'GAP Snapshot', href: '/tools/gap-snapshot' },
        { name: 'GAP Plan', href: '/tools/gap-plan' },
        { name: 'Website Lab', href: '/tools/website-lab' },
        { name: 'Brand Lab', href: '/tools/brand-lab' },
        { name: 'Content Lab', href: '/tools/content-lab' },
        { name: 'SEO Lab', href: '/tools/seo-lab' },
        { name: 'Demand Lab', href: '/tools/demand-lab' },
        { name: 'Ops Lab', href: '/tools/ops-lab' },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  // Sidebar content (shared between mobile and desktop)
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 lg:p-6 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-3">
          <HiveLogo className="h-8 lg:h-10 w-auto" />
          <div>
            <div className="text-base lg:text-lg font-bold text-slate-100">Hive OS</div>
            <div className="text-[10px] lg:text-xs text-slate-500">Growth Operating System</div>
          </div>
        </Link>
      </div>

      {/* Quick Actions - Add Company Button */}
      <div className="px-3 py-3">
        <Link
          href="/c/new"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Company
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 lg:py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <div key={item.name}>
            <Link
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {item.icon}
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                  item.badge.variant === 'danger' ? 'bg-red-500/20 text-red-400' :
                  item.badge.variant === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {item.badge.count}
                </span>
              )}
            </Link>
            {item.submenu && isActive(item.href) && (
              <div className="ml-8 mt-1 space-y-1">
                {item.submenu.map((subitem) => (
                  <Link
                    key={subitem.href}
                    href={subitem.href}
                    className={`block px-3 py-2 lg:py-1.5 rounded-lg text-sm transition-colors ${
                      pathname === subitem.href
                        ? 'text-slate-100 bg-slate-800/50'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {subitem.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Tools & Settings */}
        <div className="pt-4 lg:pt-6 mt-4 lg:mt-6 border-t border-slate-800 space-y-1">
          {bottomNavigation.map((item) => (
            <div key={item.name}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
              {item.submenu && isActive(item.href) && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.submenu.map((subitem) => (
                    <Link
                      key={subitem.href}
                      href={subitem.href}
                      className={`block px-3 py-2 lg:py-1.5 rounded-lg text-sm transition-colors ${
                        pathname === subitem.href
                          ? 'text-slate-100 bg-slate-800/50'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {subitem.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === '/settings'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </Link>
        </div>
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <HiveLogo className="h-8 w-auto" />
          <span className="text-base font-bold text-slate-100">Hive OS</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Desktop Layout */}
      <div className="hidden lg:flex">
        {/* Desktop Sidebar */}
        <aside className="fixed top-0 left-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <SidebarContent />
        </aside>

        {/* Desktop Main Content */}
        <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile Main Content */}
      <main className="lg:hidden pt-16 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
