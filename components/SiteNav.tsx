'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SiteNav() {
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close dropdowns when route changes
  useEffect(() => {
    setIsResourcesOpen(false);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleRunAuditClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    // If we're already on the homepage, just scroll
    if (pathname === '/') {
      const element = document.getElementById('run-audit');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Focus the input field after scroll
        setTimeout(() => {
          const input = element.querySelector('input');
          if (input) input.focus();
        }, 500);
      }
    } else {
      // Navigate to homepage with hash
      window.location.href = '/#run-audit';
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#050509]/95 backdrop-blur-sm border-b border-slate-800/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="text-lg font-bold text-slate-50 hover:text-yellow-400 transition-colors"
          >
            DigitalMarketingAudit.ai
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/how-it-works"
              className={`text-sm transition-colors ${
                pathname === '/how-it-works'
                  ? 'text-yellow-400 font-semibold'
                  : 'text-slate-300 hover:text-yellow-400'
              }`}
            >
              How It Works
            </Link>
            <Link
              href="/pricing"
              className={`text-sm transition-colors ${
                pathname === '/pricing'
                  ? 'text-yellow-400 font-semibold'
                  : 'text-slate-300 hover:text-yellow-400'
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/full-report-example"
              className={`text-sm transition-colors ${
                pathname === '/full-report-example'
                  ? 'text-yellow-400 font-semibold'
                  : 'text-slate-300 hover:text-yellow-400'
              }`}
            >
              Report Example
            </Link>

            {/* Resources Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsResourcesOpen(!isResourcesOpen)}
                onBlur={() => setTimeout(() => setIsResourcesOpen(false), 200)}
                className="text-sm text-slate-300 hover:text-yellow-400 transition-colors flex items-center gap-1"
              >
                Resources
                <svg
                  className={`w-4 h-4 transition-transform ${isResourcesOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isResourcesOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-2">
                  <Link
                    href="/website-audit"
                    className={`block px-4 py-2 text-sm transition-colors ${
                      pathname === '/website-audit'
                        ? 'bg-slate-800 text-yellow-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-yellow-400'
                    }`}
                  >
                    Website Audit Guide
                  </Link>
                  <Link
                    href="/seo-audit"
                    className={`block px-4 py-2 text-sm transition-colors ${
                      pathname === '/seo-audit'
                        ? 'bg-slate-800 text-yellow-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-yellow-400'
                    }`}
                  >
                    SEO Audit Guide
                  </Link>
                  <Link
                    href="/content-audit"
                    className={`block px-4 py-2 text-sm transition-colors ${
                      pathname === '/content-audit'
                        ? 'bg-slate-800 text-yellow-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-yellow-400'
                    }`}
                  >
                    Content Audit Guide
                  </Link>
                  <Link
                    href="/brand-audit"
                    className={`block px-4 py-2 text-sm transition-colors ${
                      pathname === '/brand-audit'
                        ? 'bg-slate-800 text-yellow-400 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-yellow-400'
                    }`}
                  >
                    Brand Audit Guide
                  </Link>
                </div>
              )}
            </div>

            {/* Run Audit Button */}
            <Link
              href="/#run-audit"
              onClick={handleRunAuditClick}
              className="px-5 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-sm font-semibold rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-yellow-400/20"
            >
              Run Audit
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-slate-300 hover:text-yellow-400 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <div className="flex flex-col gap-4">
              <Link
                href="/how-it-works"
                className={`text-sm transition-colors ${
                  pathname === '/how-it-works'
                    ? 'text-yellow-400 font-semibold'
                    : 'text-slate-300 hover:text-yellow-400'
                }`}
              >
                How It Works
              </Link>
              <Link
                href="/pricing"
                className={`text-sm transition-colors ${
                  pathname === '/pricing'
                    ? 'text-yellow-400 font-semibold'
                    : 'text-slate-300 hover:text-yellow-400'
                }`}
              >
                Pricing
              </Link>
              <Link
                href="/full-report-example"
                className={`text-sm transition-colors ${
                  pathname === '/full-report-example'
                    ? 'text-yellow-400 font-semibold'
                    : 'text-slate-300 hover:text-yellow-400'
                }`}
              >
                Report Example
              </Link>

              {/* Resources Section */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-400">Resources</div>
                <Link
                  href="/website-audit"
                  className={`block pl-4 text-sm transition-colors ${
                    pathname === '/website-audit'
                      ? 'text-yellow-400 font-semibold'
                      : 'text-slate-300 hover:text-yellow-400'
                  }`}
                >
                  Website Audit Guide
                </Link>
                <Link
                  href="/seo-audit"
                  className={`block pl-4 text-sm transition-colors ${
                    pathname === '/seo-audit'
                      ? 'text-yellow-400 font-semibold'
                      : 'text-slate-300 hover:text-yellow-400'
                  }`}
                >
                  SEO Audit Guide
                </Link>
                <Link
                  href="/content-audit"
                  className={`block pl-4 text-sm transition-colors ${
                    pathname === '/content-audit'
                      ? 'text-yellow-400 font-semibold'
                      : 'text-slate-300 hover:text-yellow-400'
                  }`}
                >
                  Content Audit Guide
                </Link>
                <Link
                  href="/brand-audit"
                  className={`block pl-4 text-sm transition-colors ${
                    pathname === '/brand-audit'
                      ? 'text-yellow-400 font-semibold'
                      : 'text-slate-300 hover:text-yellow-400'
                  }`}
                >
                  Brand Audit Guide
                </Link>
              </div>

              <Link
                href="/#run-audit"
                onClick={handleRunAuditClick}
                className="inline-block text-center px-5 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-sm font-semibold rounded-lg transition-all duration-200"
              >
                Run Audit
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
