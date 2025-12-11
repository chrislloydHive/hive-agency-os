'use client';

// app/c/[companyId]/helpers/HelpersClient.tsx
// AI Execution Helpers page - Browse and run guided wizards

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  MapPin,
  FileText,
  Palette,
  Zap,
  Clock,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import {
  HELPER_LIBRARY,
  getHelpersByCategory,
  searchHelpers,
  type Helper,
  type HelperCategory,
} from '@/lib/os/helpers';
import { HelperWizard } from '@/components/os/helpers/HelperWizard';

interface HelpersClientProps {
  companyId: string;
}

const categoryIcons: Record<HelperCategory, React.ReactNode> = {
  seo: <Search className="w-5 h-5" />,
  content: <FileText className="w-5 h-5" />,
  gbp: <MapPin className="w-5 h-5" />,
  brand: <Palette className="w-5 h-5" />,
  technical: <Zap className="w-5 h-5" />,
  social: <Sparkles className="w-5 h-5" />,
  analytics: <Sparkles className="w-5 h-5" />,
};

const categoryLabels: Record<HelperCategory, string> = {
  seo: 'SEO',
  content: 'Content',
  gbp: 'Google Business',
  brand: 'Brand',
  technical: 'Technical',
  social: 'Social',
  analytics: 'Analytics',
};

const categoryColors: Record<HelperCategory, string> = {
  seo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  content: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  gbp: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  brand: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  technical: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  social: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  analytics: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

export function HelpersClient({ companyId }: HelpersClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelperCategory | null>(null);
  const [activeHelper, setActiveHelper] = useState<Helper | null>(null);

  const filteredHelpers = searchQuery
    ? searchHelpers(searchQuery)
    : selectedCategory
    ? getHelpersByCategory(selectedCategory)
    : HELPER_LIBRARY;

  const categories: HelperCategory[] = ['seo', 'content', 'gbp', 'brand', 'technical', 'social'];

  if (activeHelper) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <HelperWizard
            helper={activeHelper}
            companyId={companyId}
            onComplete={() => {
              setActiveHelper(null);
              // Could show success message or redirect
            }}
            onCancel={() => setActiveHelper(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
            <Link href={`/c/${companyId}`} className="hover:text-zinc-300">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span>/</span>
            <span className="text-zinc-300">AI Helpers</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">AI Execution Helpers</h1>
              <p className="text-sm text-zinc-400">
                Guided wizards to help you complete common tasks
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) setSelectedCategory(null);
              }}
              placeholder="Search helpers..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSearchQuery('');
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !selectedCategory && !searchQuery
                ? 'bg-purple-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setSearchQuery('');
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                selectedCategory === cat
                  ? 'bg-purple-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {categoryIcons[cat]}
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Helpers Grid */}
        {filteredHelpers.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400">No helpers found matching your search</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHelpers.map((helper) => (
              <HelperCard
                key={helper.id}
                helper={helper}
                onStart={() => setActiveHelper(helper)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HelperCard({
  helper,
  onStart,
}: {
  helper: Helper;
  onStart: () => void;
}) {
  const difficultyColors = {
    beginner: 'text-emerald-400',
    intermediate: 'text-amber-400',
    advanced: 'text-red-400',
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg border ${categoryColors[helper.category]}`}>
          {categoryIcons[helper.category]}
        </div>
        <span className={`text-xs font-medium ${difficultyColors[helper.difficulty]} capitalize`}>
          {helper.difficulty}
        </span>
      </div>

      <h3 className="text-lg font-medium text-white mb-1">{helper.name}</h3>
      <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{helper.description}</p>

      <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {helper.estimatedMinutes} min
        </span>
        <span>{helper.steps.length} steps</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {helper.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded"
          >
            {tag}
          </span>
        ))}
      </div>

      <button
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
      >
        Start Helper
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default HelpersClient;
