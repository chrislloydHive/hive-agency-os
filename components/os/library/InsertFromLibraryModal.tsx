'use client';

// components/os/library/InsertFromLibraryModal.tsx
// Modal to insert a section from the library

import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, Library, Search, Globe, Building2, Trophy, Tag } from 'lucide-react';
import type { ReusableSection, SectionLibraryListResponse } from '@/lib/types/sectionLibrary';

interface InsertFromLibraryModalProps {
  companyId: string;
  onClose: () => void;
  onInsert: (section: ReusableSection) => void;
}

type TabType = 'all' | 'company' | 'global';

export function InsertFromLibraryModal({
  companyId,
  onClose,
  onInsert,
}: InsertFromLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionLibraryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<ReusableSection | null>(null);

  // Fetch sections
  useEffect(() => {
    const fetchSections = async () => {
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
    };

    fetchSections();
  }, [companyId, searchQuery, selectedTag]);

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

  const handleInsert = () => {
    if (selectedSection) {
      onInsert(selectedSection);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Insert from Library</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 flex-shrink-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            All ({sections?.total || 0})
          </button>
          <button
            onClick={() => setActiveTab('company')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
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
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
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
        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex gap-3">
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="text-center py-12">
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

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700 flex-shrink-0">
          <div className="text-sm text-slate-500">
            {selectedSection ? (
              <span>Selected: <span className="text-slate-300">{selectedSection.title}</span></span>
            ) : (
              <span>Select a section to insert</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!selectedSection}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Insert Section
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InsertFromLibraryModal;
