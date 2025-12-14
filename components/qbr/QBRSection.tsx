// components/qbr/QBRSection.tsx
// QBR Story View - Section Component
//
// Reusable section wrapper with consistent styling.

import { ReactNode } from 'react';

interface QBRSectionProps {
  number: number;
  title: string;
  children: ReactNode;
  className?: string;
}

export function QBRSection({
  number,
  title,
  children,
  className = '',
}: QBRSectionProps) {
  return (
    <section className={`mb-12 ${className}`}>
      <div className="flex items-baseline gap-4 mb-6">
        <span className="text-3xl font-light text-slate-300 print:text-slate-400">
          {number.toString().padStart(2, '0')}
        </span>
        <h2 className="text-2xl font-semibold text-slate-900">
          {title}
        </h2>
      </div>
      <div className="pl-12 print:pl-0">
        {children}
      </div>
    </section>
  );
}

/**
 * Subsection within a QBR section
 */
interface QBRSubsectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function QBRSubsection({
  title,
  children,
  className = '',
}: QBRSubsectionProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * Narrative paragraph
 */
interface QBRNarrativeProps {
  children: ReactNode;
  className?: string;
}

export function QBRNarrative({
  children,
  className = '',
}: QBRNarrativeProps) {
  return (
    <p className={`text-lg text-slate-700 leading-relaxed mb-4 ${className}`}>
      {children}
    </p>
  );
}

/**
 * Bullet list
 */
interface QBRBulletListProps {
  items: string[];
  className?: string;
}

export function QBRBulletList({
  items,
  className = '',
}: QBRBulletListProps) {
  if (items.length === 0) {
    return (
      <p className="text-slate-500 italic">No items to display</p>
    );
  }

  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-slate-700">
          <span className="text-slate-400 mt-1.5 text-xs">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Empty state placeholder
 */
interface QBREmptyStateProps {
  message: string;
}

export function QBREmptyState({ message }: QBREmptyStateProps) {
  return (
    <div className="py-8 text-center text-slate-500 italic border border-dashed border-slate-200 rounded-lg">
      {message}
    </div>
  );
}
