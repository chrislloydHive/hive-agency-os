'use client';

// app/c/[companyId]/deliver/library/page.tsx
// Section Library Browser - View and manage reusable sections

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Library,
  ChevronLeft,
  Loader2,
  Search,
  Globe,
  Building2,
  Trophy,
  Tag,
  Trash2,
  Edit3,
  ArrowUpRight,
  Copy,
} from 'lucide-react';
import type { ReusableSection, SectionLibraryListResponse } from '@/lib/types/sectionLibrary';
import { PromoteToGlobalDialog } from '@/components/os/library/PromoteToGlobalDialog';

type TabType = 'all' | 'company' | 'global';

export default function SectionLibraryPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionLibraryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<ReusableSection | null>(null);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Fetch sections
  const fetchSections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedTag) params.set('tag', selectedTag);

      const response = await fetch(
        `/api/os/companies/${companyId}/section-library?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch sections');
      }

      const data: SectionLibraryListResponse = await response.json();
      setSections(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sections');
    } finally {
      setLoading(false);
    }
  }, [companyId, searchQuery, selectedTag]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  // Filter sections by tab
  const filteredSections = useMemo(() => {
    if (!sections) return [];

    switch (activeTab) {
      case 'company':
        return sections.companySections;
      case 'global':
        return sections.globalSections;
      default:
        return sections.sections;
    }
  }, [sections, activeTab]);

  // Get all unique tags
  const allTags = useMemo(() => {
    if (!sections) return [];
    const tags = new Set<string>();
    sections.sections.forEach(s => s.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [sections]);

  // Handle delete
  const handleDelete = async (section: ReusableSection) => {
    if (!confirm(`Delete "${section.title}"? This cannot be undone.`)) return;

    setDeleting(section.id);
    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/section-library/${section.id}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete section');
      }

      // Refresh list
      fetchSections();
      if (selectedSection?.id === section.id) {
        setSelectedSection(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete section');
    } finally {
      setDeleting(null);
    }
  };

  // Handle copy to clipboard
  const handleCopy = (section: ReusableSection) => {
    navigator.clipboard.writeText(section.content);
  };

  // Handle promote complete
  const handlePromoted = (globalSection: ReusableSection) => {
    fetchSections();
    setSelectedSection(globalSection);
  };

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/c/${companyId}/deliver`}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Deliver
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Library className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Section Library</h1>
            <p className="text-sm text-slate-400">
              Reusable content from RFPs and proposals
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: List */}
        <div className="flex-1">
          {/* Tabs */}
          <div className="flex border-b border-slate-700 mb-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'all'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              All ({sections?.total || 0})
            </button>
            <button
              onClick={() => setActiveTab('company')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'company'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Company ({sections?.companySections.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('global')}
              className={`px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'global'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Globe className="w-4 h-4" />
              Global ({sections?.globalSections.length || 0})
            </button>
          </div>

          {/* Search and filters */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sections..."
                className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <select
              value={selectedTag || ''}
              onChange={(e) => setSelectedTag(e.target.value || null)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <Library className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">No Sections Found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery || selectedTag
                  ? 'Try adjusting your search or filters'
                  : 'Save sections from RFPs or proposals to build your library'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedSection?.id === section.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white truncate">{section.title}</h4>
                        {section.scope === 'global' && (
                          <Globe className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        )}
                        {section.outcome === 'won' && (
                          <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                        {section.content.slice(0, 150)}{section.content.length > 150 ? '...' : ''}
                      </p>
                      {section.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {section.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 text-xs bg-slate-700 text-slate-400 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {section.tags.length > 4 && (
                            <span className="px-1.5 py-0.5 text-xs text-slate-500">
                              +{section.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      {section.source}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        <div className="w-80 flex-shrink-0">
          {selectedSection ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 sticky top-6">
              <div className="flex items-start justify-between gap-2 mb-4">
                <h3 className="font-medium text-white">{selectedSection.title}</h3>
                <div className="flex items-center gap-1">
                  {selectedSection.scope === 'global' && (
                    <Globe className="w-4 h-4 text-purple-400" />
                  )}
                  {selectedSection.outcome === 'won' && (
                    <Trophy className="w-4 h-4 text-amber-400" />
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Scope</span>
                  <span className="text-slate-300 capitalize">{selectedSection.scope}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Source</span>
                  <span className="text-slate-300 capitalize">{selectedSection.source}</span>
                </div>
                {selectedSection.outcome && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Outcome</span>
                    <span className={selectedSection.outcome === 'won' ? 'text-emerald-400' : 'text-red-400'}>
                      {selectedSection.outcome === 'won' ? 'Won' : 'Lost'}
                    </span>
                  </div>
                )}
                {selectedSection.updatedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Updated</span>
                    <span className="text-slate-300">
                      {new Date(selectedSection.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {selectedSection.tags.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-slate-500 mb-1.5">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSection.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Content preview */}
              <div className="mb-4">
                <div className="text-xs text-slate-500 mb-1.5">Content</div>
                <div className="p-3 bg-slate-800/50 rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {selectedSection.content}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => handleCopy(selectedSection)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </button>

                {selectedSection.scope === 'company' && (
                  <>
                    <button
                      onClick={() => setShowPromoteDialog(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      Promote to Global
                    </button>

                    <button
                      onClick={() => handleDelete(selectedSection)}
                      disabled={deleting === selectedSection.id}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleting === selectedSection.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-center">
              <Library className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Select a section to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Promote dialog */}
      {showPromoteDialog && selectedSection && (
        <PromoteToGlobalDialog
          companyId={companyId}
          section={selectedSection}
          onClose={() => setShowPromoteDialog(false)}
          onPromoted={handlePromoted}
        />
      )}
    </div>
  );
}
