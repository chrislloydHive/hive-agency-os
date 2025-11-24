import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { PageEvaluatorClient } from './PageEvaluatorClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ url?: string }>;
};

export const dynamic = 'force-dynamic';

export default async function PageEvaluatorPage({ params, searchParams }: PageProps) {
  const { companyId } = await params;
  const { url: urlParam } = await searchParams;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Pre-fill with URL from query param, or fallback to company website
  const defaultUrl = urlParam || company.website || '';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-100">
                Page Evaluator
              </h1>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
                Tool
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Evaluate any web page for content quality, user experience, and conversion optimization.
              Get actionable insights and recommendations to improve performance.
            </p>
          </div>
          <Link
            href={`/os/${companyId}/diagnostics`}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            ← Back to Diagnostics
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <PageEvaluatorClient companyId={companyId} defaultUrl={defaultUrl} />

      {/* Help Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
          How It Works
        </h2>
        <div className="grid gap-4 md:grid-cols-3 text-xs text-slate-400">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-blue-400">1</span>
              </div>
              <p className="font-medium text-slate-300">Content Analysis</p>
            </div>
            <p className="leading-relaxed">
              Evaluates page title, meta description, headings, word count, and messaging clarity.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-purple-400">2</span>
              </div>
              <p className="font-medium text-slate-300">UX Assessment</p>
            </div>
            <p className="leading-relaxed">
              Checks heading hierarchy, section structure, navigation, visual breaks, and accessibility.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-emerald-400">3</span>
              </div>
              <p className="font-medium text-slate-300">Conversion Review</p>
            </div>
            <p className="leading-relaxed">
              Detects CTAs, trust signals (testimonials, logos), and conversion optimization opportunities.
            </p>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Scoring Methodology
        </h2>
        <div className="grid gap-4 md:grid-cols-3 text-xs">
          <div className="rounded-lg border border-slate-800 bg-[#050509]/50 p-3">
            <p className="font-medium text-blue-400 mb-2">Content Score (30%)</p>
            <ul className="space-y-1 text-slate-400 list-disc list-inside">
              <li>Page title (20pts)</li>
              <li>Meta description (15pts)</li>
              <li>H1 heading (15pts)</li>
              <li>Word count (20pts)</li>
              <li>Hero copy (10pts)</li>
              <li>Clarity (20pts)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#050509]/50 p-3">
            <p className="font-medium text-purple-400 mb-2">UX Score (30%)</p>
            <ul className="space-y-1 text-slate-400 list-disc list-inside">
              <li>H1 presence (20pts)</li>
              <li>Heading hierarchy (20pts)</li>
              <li>Section structure (20pts)</li>
              <li>Visual breaks (15pts)</li>
              <li>Navigation (15pts)</li>
              <li>Links (10pts)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#050509]/50 p-3">
            <p className="font-medium text-emerald-400 mb-2">Conversion Score (40%)</p>
            <ul className="space-y-1 text-slate-400 list-disc list-inside">
              <li>Primary CTA (30pts)</li>
              <li>CTA placement (20pts)</li>
              <li>Multiple CTAs (15pts)</li>
              <li>Trust signals (20pts)</li>
              <li>Contact path (15pts)</li>
            </ul>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-4 text-center">
          Overall Score = (Conversion × 0.4) + (Content × 0.3) + (UX × 0.3)
        </p>
      </div>
    </div>
  );
}
