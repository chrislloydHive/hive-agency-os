// app/(public)/layout.tsx
// Dedicated layout for public client-facing pages (no sidebar, no auth, no internal nav).
//
// Routes under /review/* use this layout. OSLayout detects /review paths and
// renders children full-width without the internal app shell (no sidebar,
// Add Company button, or internal nav links).
//
// - Token-only access (no Google/session auth)
// - Full-width: project title, variant tabs (Prospecting/Retargeting), tactic sections

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
    <div className="min-h-screen bg-[#111827] text-gray-100 antialiased">
      {children}
    </div>
  );
}
