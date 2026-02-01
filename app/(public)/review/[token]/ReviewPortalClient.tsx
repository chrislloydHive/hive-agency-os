'use client';

// ReviewPortalClient.tsx
// Client component: renders tabbed variant sections (Prospecting/Retargeting)
// with per-tactic approval UI.

import { useState } from 'react';
import ReviewSection from './ReviewSection';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
}

interface TacticSectionData {
  variant: string;
  tactic: string;
  assets: ReviewAsset[];
  fileCount: number;
}

interface TacticFeedback {
  approved: boolean;
  comments: string;
}

type ReviewData = Record<string, TacticFeedback>;

interface ReviewPortalClientProps {
  projectName: string;
  sections: TacticSectionData[];
  reviewData: ReviewData;
  token: string;
  variants: string[];
}

export default function ReviewPortalClient({
  projectName,
  sections,
  reviewData,
  token,
  variants,
}: ReviewPortalClientProps) {
  const [activeVariant, setActiveVariant] = useState(variants[0]);

  // Filter sections by active variant
  const activeSections = sections.filter((s) => s.variant === activeVariant);

  return (
    <main className="min-h-screen bg-[#111827] text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-white sm:text-3xl">
          {projectName} &ndash; Creative Review
        </h1>

        {/* Variant Tabs */}
        <div className="mb-8 flex gap-2 border-b border-gray-700">
          {variants.map((variant) => {
            const isActive = variant === activeVariant;
            const variantSections = sections.filter((s) => s.variant === variant);
            const totalFiles = variantSections.reduce((sum, s) => sum + s.fileCount, 0);
            const approvedCount = variantSections.filter(
              (s) => reviewData[`${variant}:${s.tactic}`]?.approved
            ).length;

            return (
              <button
                key={variant}
                onClick={() => setActiveVariant(variant)}
                className={`relative px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-amber-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {variant}
                <span className="ml-2 text-xs text-gray-500">
                  ({totalFiles} files, {approvedCount}/{variantSections.length} approved)
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tactic Sections for Active Variant */}
        {activeSections.map((section) => {
          const feedbackKey = `${section.variant}:${section.tactic}`;
          return (
            <ReviewSection
              key={feedbackKey}
              variant={section.variant}
              tactic={section.tactic}
              assets={section.assets}
              fileCount={section.fileCount}
              token={token}
              initialFeedback={reviewData[feedbackKey] ?? { approved: false, comments: '' }}
            />
          );
        })}
      </div>
    </main>
  );
}
