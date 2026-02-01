// app/(public)/layout.tsx
// Dedicated layout for public client-facing pages (no sidebar, no auth, no internal nav).
//
// This layout REPLACES the root layout for all routes under /review/*.
// It provides a clean, minimal experience for external clients:
// - No Hive OS sidebar/header
// - No "Add Company" button
// - No internal navigation links
// - Token-only access (no Google/session auth)
//
// In Next.js App Router, defining <html> and <body> here makes this a root layout
// for the (public) route group, bypassing app/layout.tsx entirely.

import type { Metadata, Viewport } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Client Review Portal',
  description: 'Review and approve creative assets for your project.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#111827] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
