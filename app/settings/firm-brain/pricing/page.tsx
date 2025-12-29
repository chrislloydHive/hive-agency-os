'use client';

// app/settings/firm-brain/pricing/page.tsx
// Pricing Templates Management - Simplified with smart description parsing

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Plus,
  Trash2,
  Save,
  Search,
  Loader2,
  CheckCircle,
  Pencil,
  Eye,
  FileText,
  Link2,
  ExternalLink,
  Download,
  Filter,
} from 'lucide-react';
import type {
  PricingTemplate,
  PricingTemplateInput,
  DescriptionSection,
} from '@/lib/types/firmBrain';
import {
  parseDescriptionSections,
  getDescriptionPreview,
  PRICING_TEMPLATE_SCAFFOLD,
  DESCRIPTION_SECTION_LABELS,
} from '@/lib/types/firmBrain';

// ============================================================================
// Section Label Colors
// ============================================================================

const SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Best for': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Typical range': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  'Billing': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  'Includes': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  'Excludes': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  'Common add-ons': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  'Pricing modifiers': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  'Notes': { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
};

function getSectionColor(label: string) {
  return SECTION_COLORS[label] || { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' };
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function PricingTemplatesPage() {
  const [templates, setTemplates] = useState<PricingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<PricingTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [search, setSearch] = useState('');
  const [hasFileFilter, setHasFileFilter] = useState<boolean | null>(null);
  const [hasOppsFilter, setHasOppsFilter] = useState<boolean | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (hasFileFilter !== null) params.set('hasFile', String(hasFileFilter));
      if (hasOppsFilter !== null) params.set('hasOpportunities', String(hasOppsFilter));

      const response = await fetch(`/api/settings/firm-brain/pricing-templates?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.pricingTemplates || []);
      }
    } catch (err) {
      console.error('Failed to fetch pricing templates:', err);
    } finally {
      setLoading(false);
    }
  }, [search, hasFileFilter, hasOppsFilter]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    const template = templates.find((t) => t.id === selectedId);
    setEditedTemplate(template ? JSON.parse(JSON.stringify(template)) : null);
    setIsEditMode(false);
  }, [selectedId, templates]);

  // Create new template with scaffold
  const handleCreate = useCallback(async () => {
    try {
      const newTemplate: PricingTemplateInput = {
        name: 'New Pricing Template',
        description: PRICING_TEMPLATE_SCAFFOLD,
      };

      const response = await fetch('/api/settings/firm-brain/pricing-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates((prev) => [...prev, data.pricingTemplate]);
        setSelectedId(data.pricingTemplate.id);
        setIsEditMode(true);
      }
    } catch (err) {
      console.error('Failed to create template:', err);
    }
  }, []);

  // Save template
  const handleSave = useCallback(async () => {
    if (!editedTemplate) return;

    setSaving(true);
    try {
      const response = await fetch(
        `/api/settings/firm-brain/pricing-templates/${editedTemplate.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editedTemplate.name,
            description: editedTemplate.description,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTemplates((prev) =>
          prev.map((t) => (t.id === data.pricingTemplate.id ? data.pricingTemplate : t))
        );
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSaving(false);
    }
  }, [editedTemplate]);

  // Delete template
  const handleDelete = useCallback(async () => {
    if (!editedTemplate || !confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(
        `/api/settings/firm-brain/pricing-templates/${editedTemplate.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== editedTemplate.id));
        setSelectedId(null);
        setEditedTemplate(null);
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  }, [editedTemplate]);

  // Seed templates
  const handleSeed = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/pricing-templates/seed', {
        method: 'POST',
      });
      if (response.ok) {
        await fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to seed templates:', err);
    }
  }, [fetchTemplates]);

  // Clear filters
  const clearFilters = () => {
    setHasFileFilter(null);
    setHasOppsFilter(null);
  };

  const hasActiveFilters = hasFileFilter !== null || hasOppsFilter !== null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pricing Templates</h1>
            <p className="text-sm text-slate-400">
              Reusable pricing structures for proposals
            </p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      <div className="flex gap-6">
        {/* Left Sidebar - Template List */}
        <div className="w-72 flex-shrink-0 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <Filter className="w-3 h-3" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-emerald-500 text-white rounded-full">
                  {(hasFileFilter !== null ? 1 : 0) + (hasOppsFilter !== null ? 1 : 0)}
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg space-y-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Has File</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { label: 'Any', value: null },
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setHasFileFilter(opt.value)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        hasFileFilter === opt.value
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide">Used in Opps</label>
                <div className="flex gap-2 mt-1">
                  {[
                    { label: 'Any', value: null },
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setHasOppsFilter(opt.value)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        hasOppsFilter === opt.value
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Template List */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No templates found</p>
                <button
                  onClick={handleSeed}
                  className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  Seed starter templates
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
                {templates.map((template) => (
                  <TemplateListItem
                    key={template.id}
                    template={template}
                    isSelected={selectedId === template.id}
                    onClick={() => setSelectedId(template.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Template Detail/Editor */}
        <div className="flex-1 min-w-0">
          {editedTemplate ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editedTemplate.name}
                      onChange={(e) =>
                        setEditedTemplate({ ...editedTemplate, name: e.target.value })
                      }
                      className="text-lg font-semibold text-white bg-transparent border-b border-slate-600 focus:border-emerald-500 focus:outline-none flex-1"
                    />
                  ) : (
                    <h2 className="text-lg font-semibold text-white truncate">
                      {editedTemplate.name}
                    </h2>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      isEditMode
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {isEditMode ? <Eye className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                    {isEditMode ? 'View' : 'Edit'}
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[calc(100vh-280px)] overflow-y-auto">
                {/* Badges Row */}
                <div className="flex items-center gap-3">
                  {editedTemplate.examplePricingFiles.length > 0 && (
                    <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                      <FileText className="w-3 h-3" />
                      {editedTemplate.examplePricingFiles.length} File
                      {editedTemplate.examplePricingFiles.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {editedTemplate.relevantOpportunities.length > 0 && (
                    <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
                      <Link2 className="w-3 h-3" />
                      Used in {editedTemplate.relevantOpportunities.length} opp
                      {editedTemplate.relevantOpportunities.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Description */}
                {isEditMode ? (
                  <DescriptionEditor
                    description={editedTemplate.description}
                    onChange={(desc) =>
                      setEditedTemplate({ ...editedTemplate, description: desc })
                    }
                  />
                ) : (
                  <DescriptionView description={editedTemplate.description} />
                )}

                {/* Example Pricing Files */}
                {editedTemplate.examplePricingFiles.length > 0 && (
                  <div className="border border-slate-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      Example Pricing Files
                    </h3>
                    <div className="space-y-2">
                      {editedTemplate.examplePricingFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-2 bg-slate-800/50 rounded"
                        >
                          <span className="text-sm text-slate-300 truncate">{file.filename}</span>
                          <div className="flex items-center gap-2">
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-slate-400 hover:text-white transition-colors"
                              title="Open"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <a
                              href={file.url}
                              download={file.filename}
                              className="p-1.5 text-slate-400 hover:text-white transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relevant Opportunities */}
                {editedTemplate.relevantOpportunities.length > 0 && (
                  <div className="border border-slate-800 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-purple-400" />
                      Linked Opportunities
                    </h3>
                    <div className="space-y-2">
                      {editedTemplate.relevantOpportunities.map((opp) => (
                        <div
                          key={opp.id}
                          className="flex items-center justify-between p-2 bg-slate-800/50 rounded"
                        >
                          <span className="text-sm text-slate-300">{opp.name}</span>
                          <span className="text-xs text-slate-500 font-mono">{opp.id.slice(0, 8)}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {isEditMode && (
                  <div className="flex items-center justify-between pt-6 border-t border-slate-800">
                    <button
                      onClick={handleDelete}
                      className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : saveSuccess ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saveSuccess ? 'Saved' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
              <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select a template to view details</p>
              <button
                onClick={handleCreate}
                className="mt-4 text-sm text-emerald-400 hover:text-emerald-300"
              >
                or create a new one
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Template List Item
// ============================================================================

interface TemplateListItemProps {
  template: PricingTemplate;
  isSelected: boolean;
  onClick: () => void;
}

function TemplateListItem({ template, isSelected, onClick }: TemplateListItemProps) {
  const preview = getDescriptionPreview(template.description, 100);
  const hasFile = template.examplePricingFiles.length > 0;
  const oppCount = template.relevantOpportunities.length;

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : 'hover:bg-slate-800/50'
      }`}
    >
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-white text-sm leading-tight">{template.name}</span>
        </div>

        {preview && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{preview}</p>
        )}

        {/* Badges */}
        {(hasFile || oppCount > 0) && (
          <div className="flex items-center gap-2 pt-1">
            {hasFile && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded">
                <FileText className="w-2.5 h-2.5" />
                File
              </span>
            )}
            {oppCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-400 rounded">
                <Link2 className="w-2.5 h-2.5" />
                {oppCount} opp{oppCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Description View - Smart section rendering
// ============================================================================

interface DescriptionViewProps {
  description: string;
}

function DescriptionView({ description }: DescriptionViewProps) {
  const sections = parseDescriptionSections(description);

  if (sections.length === 0) {
    return <p className="text-sm text-slate-500 italic">No description</p>;
  }

  return (
    <div className="space-y-4">
      {sections.map((section, i) => (
        <DescriptionSectionCard key={i} section={section} />
      ))}
    </div>
  );
}

interface DescriptionSectionCardProps {
  section: DescriptionSection;
}

function DescriptionSectionCard({ section }: DescriptionSectionCardProps) {
  const colors = getSectionColor(section.label);
  const lines = section.content.split('\n').filter((l) => l.trim());

  // Check if content is a bullet list
  const isList = lines.every((l) => l.trim().startsWith('-') || l.trim().startsWith('*'));

  if (!section.label) {
    // Unlabeled intro text
    return <p className="text-sm text-slate-300 leading-relaxed">{section.content}</p>;
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${colors.border}`}>
      <div className={`px-3 py-2 ${colors.bg}`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
          {section.label}
        </span>
      </div>
      <div className="px-3 py-3 bg-slate-900/30">
        {isList ? (
          <ul className="space-y-1">
            {lines.map((line, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-slate-500 mt-0.5">-</span>
                <span>{line.replace(/^[-*]\s*/, '')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {section.content}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Description Editor - Guided scaffold
// ============================================================================

interface DescriptionEditorProps {
  description: string;
  onChange: (description: string) => void;
}

function DescriptionEditor({ description, onChange }: DescriptionEditorProps) {
  const [showScaffoldHelp, setShowScaffoldHelp] = useState(false);

  const insertScaffold = () => {
    if (!description.trim() || confirm('Replace current description with scaffold?')) {
      onChange(PRICING_TEMPLATE_SCAFFOLD);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-white">Description</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScaffoldHelp(!showScaffoldHelp)}
            className="text-xs text-slate-400 hover:text-slate-300"
          >
            {showScaffoldHelp ? 'Hide tips' : 'Formatting tips'}
          </button>
          <button
            onClick={insertScaffold}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            Insert scaffold
          </button>
        </div>
      </div>

      {showScaffoldHelp && (
        <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-slate-400 space-y-2">
          <p>Use section labels to organize your description. Recognized labels:</p>
          <div className="flex flex-wrap gap-1">
            {DESCRIPTION_SECTION_LABELS.map((label) => {
              const colors = getSectionColor(label);
              return (
                <span
                  key={label}
                  className={`px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                >
                  {label}:
                </span>
              );
            })}
          </div>
          <p className="text-slate-500">
            Example: &quot;Best for: Startups needing brand foundation&quot;
          </p>
        </div>
      )}

      <textarea
        value={description}
        onChange={(e) => onChange(e.target.value)}
        rows={20}
        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
        placeholder="Best for: [ideal clients]

Typical range: [price range]

Billing: [one-time / monthly / etc]

Includes:
- Item 1
- Item 2

Excludes:
- Item 1

Notes: [additional context]"
      />
    </div>
  );
}
