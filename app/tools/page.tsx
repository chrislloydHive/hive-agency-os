// app/tools/page.tsx
// Tools Hub - Central page listing diagnostic and strategic tools

import Link from 'next/link';
import {
  COMPANY_TOOL_DEFS,
  getDiagnosticTools,
  getStrategicTools,
  getCategoryColor,
  type CompanyToolDefinition,
  type ToolIcon,
} from '@/lib/tools/registry';

// Tool icon component using inline SVGs (consistent with Blueprint)
function ToolIconSvg({ icon, className }: { icon: ToolIcon; className?: string }) {
  const baseClass = className || 'w-5 h-5';

  switch (icon) {
    case 'zap':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    case 'fileText':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case 'layers':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'globe':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case 'search':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'fileEdit':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    case 'trendingUp':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'barChart':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'tv':
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className={baseClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

// Tool card component
function ToolCard({ tool }: { tool: CompanyToolDefinition }) {
  const slug = tool.urlSlug || tool.id;

  return (
    <Link
      href={`/tools/${slug}`}
      className="group bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 hover:bg-slate-900 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-lg ${getCategoryColor(tool.category)}`}>
          <ToolIconSvg icon={tool.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-slate-100 font-medium group-hover:text-amber-400 transition-colors">
            {tool.label}
          </h3>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">
            {tool.description}
          </p>
          {tool.estimatedMinutes && (
            <p className="text-xs text-slate-600 mt-2">
              ~{tool.estimatedMinutes} min
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// Group tools by category for display
function groupToolsByCategory(tools: CompanyToolDefinition[]): Map<string, CompanyToolDefinition[]> {
  const grouped = new Map<string, CompanyToolDefinition[]>();

  for (const tool of tools) {
    const existing = grouped.get(tool.category) || [];
    existing.push(tool);
    grouped.set(tool.category, existing);
  }

  return grouped;
}

export default function ToolsPage() {
  const diagnosticTools = getDiagnosticTools().filter(t => t.status === 'enabled');
  const strategicTools = getStrategicTools().filter(t => t.status === 'enabled');

  const diagnosticByCategory = groupToolsByCategory(diagnosticTools);
  const strategicByCategory = groupToolsByCategory(strategicTools);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Tools</h1>
        <p className="text-slate-400">
          Run diagnostics and design strategies for clients using Hive OS labs.
        </p>
      </div>

      {/* Diagnostic Tools Section */}
      <section className="space-y-6 mb-12">
        <header>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Diagnostic Tools
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Run assessments and diagnostics on client websites and marketing to identify opportunities and issues.
          </p>
        </header>

        <div className="space-y-8">
          {Array.from(diagnosticByCategory.entries()).map(([category, tools]) => (
            <div key={category}>
              <h3 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${getCategoryColor(category as any).split(' ')[0]}`}>
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Strategic Tools Section */}
      {strategicTools.length > 0 && (
        <section className="space-y-6">
          <header>
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Strategic Tools
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Design forward-looking strategies, media plans, and growth programs, then promote them into active execution.
            </p>
          </header>

          <div className="space-y-8">
            {Array.from(strategicByCategory.entries()).map(([category, tools]) => (
              <div key={category}>
                <h3 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${getCategoryColor(category as any).split(' ')[0]}`}>
                  {category}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
