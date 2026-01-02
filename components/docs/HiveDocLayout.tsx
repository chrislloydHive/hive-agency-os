'use client';

// components/docs/HiveDocLayout.tsx
// Main layout wrapper for HiveDoc printable templates
//
// Handles:
// - Page container sizing (Letter/A4)
// - Print styles and page breaks
// - Document metadata

import { ReactNode } from 'react';
import type { HiveDocMeta } from '@/lib/types/hiveDoc';

interface HiveDocLayoutProps {
  meta: HiveDocMeta;
  children: ReactNode;
}

export function HiveDocLayout({ meta, children }: HiveDocLayoutProps) {
  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.5in 0.6in;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .hive-doc {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .hive-doc-page {
            page-break-after: always;
            break-after: page;
          }

          .hive-doc-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .no-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .page-break {
            page-break-before: always;
            break-before: page;
          }

          .hive-doc-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
          }

          /* Hide screen-only elements */
          .screen-only {
            display: none !important;
          }
        }

        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Controls */}
      <div className="screen-only fixed top-4 right-4 z-50 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium rounded-lg shadow-lg transition-colors"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Document Container */}
      <div className="hive-doc min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
        <div className="max-w-[8.5in] mx-auto bg-white shadow-lg print:shadow-none print:max-w-none">
          {/* Document Header */}
          <HiveDocHeader meta={meta} />

          {/* Document Content */}
          <div className="px-12 pb-12 print:px-0 print:pb-0">{children}</div>

          {/* Document Footer */}
          <HiveDocFooter />
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Header Component
// ============================================================================

function HiveDocHeader({ meta }: { meta: HiveDocMeta }) {
  return (
    <div className="pt-8 pb-6 px-12 print:pt-0 print:px-0">
      {/* Document Type Label - Top Right */}
      <div className="text-right mb-6">
        <span className="text-sm text-gray-500 tracking-wide">{meta.documentType}</span>
      </div>

      {/* Hive Logo */}
      <div className="text-center mb-6">
        <HiveLogo />
      </div>

      {/* Title & Subtitle */}
      <div className="text-center">
        <h1 className="text-3xl font-normal text-gray-800 mb-2">{meta.title}</h1>
        <p className="text-lg text-gray-500">{meta.subtitle}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Logo Component
// ============================================================================

function HiveLogo() {
  return (
    <img
      src="/hive-logo.svg"
      alt="Hive"
      className="h-12 w-auto"
    />
  );
}

// ============================================================================
// Footer Component
// ============================================================================

function HiveDocFooter() {
  return (
    <div className="hive-doc-footer py-4 text-center border-t border-gray-200 print:border-0">
      <span className="text-sm text-gray-400">Page 1 of 1 | Confidential</span>
    </div>
  );
}

export { HiveDocHeader, HiveDocFooter, HiveLogo };
