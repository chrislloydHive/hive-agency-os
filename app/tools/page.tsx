// app/tools/page.tsx
// Tools Hub - Central page listing all diagnostic tools

import Link from 'next/link';
import { DIAGNOSTIC_TOOLS, getCategoryLabel, getCategoryColor, getAllCategories } from '@/lib/os/diagnostics/tools';
import * as LucideIcons from 'lucide-react';

// Map tool IDs to URL slugs
const toolIdToSlug: Record<string, string> = {
  gapSnapshot: 'gap-snapshot',
  gapPlan: 'gap-plan',
  websiteLab: 'website-lab',
  brandLab: 'brand-lab',
  contentLab: 'content-lab',
  seoLab: 'seo-lab',
  demandLab: 'demand-lab',
  opsLab: 'ops-lab',
};

export default function ToolsPage() {
  const categories = getAllCategories();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Diagnostic Tools</h1>
        <p className="text-slate-400">
          Run assessments and diagnostics on client websites to identify opportunities and issues.
        </p>
      </div>

      {/* Tools by Category */}
      <div className="space-y-8">
        {categories.map((category) => {
          const tools = DIAGNOSTIC_TOOLS.filter((t) => t.category === category);
          if (tools.length === 0) return null;

          return (
            <div key={category}>
              <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${getCategoryColor(category).split(' ')[0]}`}>
                {getCategoryLabel(category)}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tools.map((tool) => {
                  // Get the Lucide icon component
                  const IconComponent = (LucideIcons as any)[tool.icon] || LucideIcons.HelpCircle;
                  const slug = toolIdToSlug[tool.id] || tool.id;

                  return (
                    <Link
                      key={tool.id}
                      href={`/tools/${slug}`}
                      className="group bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 hover:bg-slate-900 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-lg ${getCategoryColor(tool.category)}`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-slate-100 font-medium group-hover:text-yellow-400 transition-colors">
                            {tool.label}
                          </h3>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                            {tool.description}
                          </p>
                          {tool.estimatedTime && (
                            <p className="text-xs text-slate-600 mt-2">
                              ~{tool.estimatedTime}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
