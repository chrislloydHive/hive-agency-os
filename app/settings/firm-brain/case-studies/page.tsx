'use client';

// app/settings/firm-brain/case-studies/page.tsx
// Case Studies Management - Redesigned for readability and ease of comprehension

import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Save,
  Search,
  Loader2,
  Globe,
  Lock,
  CheckCircle,
} from 'lucide-react';
import type {
  CaseStudy,
  CaseStudyPermission,
  CaseStudyVisual,
  CaseStudyVisualType,
  CaseStudyMediaType,
  CaseStudyClientLogo as ClientLogoType,
} from '@/lib/types/firmBrain';
import {
  CaseStudyVisualGallery,
  CaseStudyListItem,
  CaseStudyHeader,
  CaseStudySections,
  CaseStudyMeta,
} from '@/components/os/case-studies';

type PermissionFilter = 'all' | CaseStudyPermission;

export default function CaseStudiesPage() {
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedStudy, setEditedStudy] = useState<CaseStudy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [search, setSearch] = useState('');
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>('all');
  const [isEditMode, setIsEditMode] = useState(false);
  const [showVisualModal, setShowVisualModal] = useState(false);
  const [editingVisual, setEditingVisual] = useState<CaseStudyVisual | null>(null);
  const [showLogoModal, setShowLogoModal] = useState(false);

  const fetchStudies = useCallback(async () => {
    try {
      const response = await fetch('/api/os/case-studies');
      if (response.ok) {
        const data = await response.json();
        setStudies(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch case studies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudies();
  }, [fetchStudies]);

  useEffect(() => {
    const study = studies.find((s) => s.id === selectedId);
    setEditedStudy(study ? { ...study } : null);
    // Reset edit mode when switching studies
    setIsEditMode(false);
  }, [selectedId, studies]);

  const handleCreate = useCallback(async () => {
    try {
      const response = await fetch('/api/os/case-studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Case Study',
          client: 'Client Name',
          summary: null,
          problem: null,
          approach: null,
          outcome: null,
          industry: null,
          services: [],
          metrics: {},
          assets: [],
          tags: [],
          permissionLevel: 'internal',
          visibility: 'internal',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setStudies((prev) => [...prev, data.data]);
        setSelectedId(data.data.id);
        setIsEditMode(true); // Start in edit mode for new studies
      }
    } catch (err) {
      console.error('Failed to create case study:', err);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!editedStudy) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/os/case-studies/${editedStudy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editedStudy,
          visibility: editedStudy.permissionLevel,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setStudies((prev) =>
          prev.map((s) => (s.id === editedStudy.id ? data.data : s))
        );
        // Show success toast
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save case study:', err);
    } finally {
      setSaving(false);
    }
  }, [editedStudy]);

  const handleDelete = useCallback(async () => {
    if (!editedStudy || !confirm('Delete this case study?')) return;
    const response = await fetch(`/api/os/case-studies/${editedStudy.id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      setStudies((prev) => prev.filter((s) => s.id !== editedStudy.id));
      setSelectedId(null);
    }
  }, [editedStudy]);

  // Service handlers
  const handleAddService = useCallback(
    (service: string) => {
      if (!editedStudy) return;
      if (!editedStudy.services.includes(service)) {
        setEditedStudy({
          ...editedStudy,
          services: [...editedStudy.services, service],
        });
      }
    },
    [editedStudy]
  );

  const handleRemoveService = useCallback(
    (service: string) => {
      if (!editedStudy) return;
      setEditedStudy({
        ...editedStudy,
        services: editedStudy.services.filter((s) => s !== service),
      });
    },
    [editedStudy]
  );

  // Tag handlers
  const handleAddTag = useCallback(
    (tag: string) => {
      if (!editedStudy) return;
      if (!editedStudy.tags.includes(tag)) {
        setEditedStudy({
          ...editedStudy,
          tags: [...editedStudy.tags, tag],
        });
      }
    },
    [editedStudy]
  );

  const handleRemoveTag = useCallback(
    (tag: string) => {
      if (!editedStudy) return;
      setEditedStudy({
        ...editedStudy,
        tags: editedStudy.tags.filter((t) => t !== tag),
      });
    },
    [editedStudy]
  );

  // Visual handlers
  const handleAddVisual = useCallback(() => {
    setEditingVisual(null);
    setShowVisualModal(true);
  }, []);

  const handleEditVisual = useCallback((visual: CaseStudyVisual) => {
    setEditingVisual(visual);
    setShowVisualModal(true);
  }, []);

  const handleRemoveVisual = useCallback(
    (id: string) => {
      if (!editedStudy) return;
      setEditedStudy({
        ...editedStudy,
        visuals: editedStudy.visuals.filter((v) => v.id !== id),
      });
    },
    [editedStudy]
  );

  const handleSaveVisual = useCallback(
    (visual: CaseStudyVisual) => {
      if (!editedStudy) return;
      if (editingVisual) {
        setEditedStudy({
          ...editedStudy,
          visuals: editedStudy.visuals.map((v) =>
            v.id === visual.id ? visual : v
          ),
        });
      } else {
        setEditedStudy({
          ...editedStudy,
          visuals: [...editedStudy.visuals, visual],
        });
      }
      setShowVisualModal(false);
      setEditingVisual(null);
    },
    [editedStudy, editingVisual]
  );

  // Client logo handlers
  const handleEditLogo = useCallback(() => {
    setShowLogoModal(true);
  }, []);

  const handleRemoveLogo = useCallback(() => {
    if (!editedStudy) return;
    setEditedStudy({
      ...editedStudy,
      clientLogo: null,
    });
  }, [editedStudy]);

  const handleConfirmLogo = useCallback(() => {
    if (!editedStudy?.clientLogo) return;
    setEditedStudy({
      ...editedStudy,
      clientLogo: {
        ...editedStudy.clientLogo,
        source: 'manual',
      },
    });
  }, [editedStudy]);

  const handleSaveLogo = useCallback(
    (logo: ClientLogoType) => {
      if (!editedStudy) return;
      setEditedStudy({
        ...editedStudy,
        clientLogo: {
          ...logo,
          source: 'manual', // Always mark as manual when saved via UI
        },
      });
      setShowLogoModal(false);
    },
    [editedStudy]
  );

  // Edit mode field handlers
  const updateField = useCallback(
    <K extends keyof CaseStudy>(field: K, value: CaseStudy[K]) => {
      if (!editedStudy) return;
      setEditedStudy({ ...editedStudy, [field]: value });
    },
    [editedStudy]
  );

  // Filter studies by permission and search
  const filteredStudies = studies.filter((s) => {
    if (permissionFilter !== 'all' && s.permissionLevel !== permissionFilter) {
      return false;
    }
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        s.title.toLowerCase().includes(searchLower) ||
        s.client.toLowerCase().includes(searchLower) ||
        s.industry?.toLowerCase().includes(searchLower) ||
        s.services.some((svc) => svc.toLowerCase().includes(searchLower)) ||
        s.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Briefcase className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Case Studies</h1>
            <p className="text-sm text-slate-400">
              Portfolio work and client outcomes
            </p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      <div className="flex gap-6">
        {/* Left Sidebar - Case Study List */}
        <div className="w-64 flex-shrink-0 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, client, industry..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Permission Filter Tabs */}
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg">
            {(['all', 'public', 'internal'] as PermissionFilter[]).map(
              (filter) => (
                <button
                  key={filter}
                  onClick={() => setPermissionFilter(filter)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    permissionFilter === filter
                      ? 'bg-purple-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter === 'public' && <Globe className="w-3 h-3" />}
                  {filter === 'internal' && <Lock className="w-3 h-3" />}
                  {filter === 'all'
                    ? 'All'
                    : filter === 'public'
                    ? 'Public'
                    : 'Internal'}
                </button>
              )
            )}
          </div>

          {/* Case Study List */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : filteredStudies.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No case studies found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50 max-h-[600px] overflow-y-auto">
                {filteredStudies.map((study) => (
                  <CaseStudyListItem
                    key={study.id}
                    study={study}
                    isSelected={selectedId === study.id}
                    onClick={() => setSelectedId(study.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Case Study Detail/Editor */}
        <div className="flex-1 min-w-0">
          {editedStudy ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              {/* Header Section */}
              <CaseStudyHeader
                study={editedStudy}
                isEditMode={isEditMode}
                onToggleEditMode={() => setIsEditMode(!isEditMode)}
                onEditTitle={(title) => updateField('title', title)}
                onEditClient={(client) => updateField('client', client)}
                onEditIndustry={(industry) => updateField('industry', industry)}
                onEditPermission={(permission) => {
                  updateField('permissionLevel', permission);
                  updateField('visibility', permission);
                }}
                onEditLogo={handleEditLogo}
                onRemoveLogo={handleRemoveLogo}
                onConfirmLogo={handleConfirmLogo}
              />

              {/* Content */}
              <div className="p-6 space-y-8">
                {/* Services & Tags */}
                <CaseStudyMeta
                  services={editedStudy.services}
                  tags={editedStudy.tags}
                  isEditMode={isEditMode}
                  onAddService={handleAddService}
                  onRemoveService={handleRemoveService}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                />

                {/* Story Sections */}
                <CaseStudySections
                  summary={editedStudy.summary}
                  problem={editedStudy.problem}
                  approach={editedStudy.approach}
                  outcome={editedStudy.outcome}
                  isEditMode={isEditMode}
                  onChangeSummary={(v) => updateField('summary', v)}
                  onChangeProblem={(v) => updateField('problem', v)}
                  onChangeApproach={(v) => updateField('approach', v)}
                  onChangeOutcome={(v) => updateField('outcome', v)}
                />

                {/* Visuals Gallery */}
                <CaseStudyVisualGallery
                  visuals={editedStudy.visuals || []}
                  editable
                  isEditMode={isEditMode}
                  onAddVisual={handleAddVisual}
                  onRemoveVisual={handleRemoveVisual}
                  onEditVisual={handleEditVisual}
                />

                {/* Actions - Only show in edit mode */}
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
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium rounded-lg transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">
                Select a case study to view or edit
              </p>
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 px-4 py-2 text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create New Case Study
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save Success Toast */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-green-500/90 text-white rounded-lg shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="w-5 h-5" />
          Changes saved successfully
        </div>
      )}

      {/* Visual Editor Modal */}
      {showVisualModal && (
        <VisualEditorModal
          visual={editingVisual}
          onSave={handleSaveVisual}
          onClose={() => {
            setShowVisualModal(false);
            setEditingVisual(null);
          }}
        />
      )}

      {/* Client Logo Editor Modal */}
      {showLogoModal && (
        <LogoEditorModal
          logo={editedStudy?.clientLogo || null}
          onSave={handleSaveLogo}
          onClose={() => setShowLogoModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Visual Editor Modal
// ============================================================================

interface VisualEditorModalProps {
  visual: CaseStudyVisual | null;
  onSave: (visual: CaseStudyVisual) => void;
  onClose: () => void;
}

function VisualEditorModal({ visual, onSave, onClose }: VisualEditorModalProps) {
  const [formData, setFormData] = useState<Partial<CaseStudyVisual>>({
    id: visual?.id || `visual-${Date.now()}`,
    type: visual?.type || 'campaign',
    mediaType: visual?.mediaType || 'image',
    title: visual?.title || '',
    caption: visual?.caption || '',
    assetUrl: visual?.assetUrl || '',
    linkUrl: visual?.linkUrl || '',
    thumbnailUrl: visual?.thumbnailUrl || '',
    order: visual?.order || 0,
    visibility: visual?.visibility || 'internal',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetUrl) return;
    onSave(formData as CaseStudyVisual);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">
          {visual ? 'Edit Visual' : 'Add Visual'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type & Media Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value as CaseStudyVisualType,
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="hero">Hero</option>
                <option value="campaign">Campaign</option>
                <option value="before_after">Before/After</option>
                <option value="process">Process</option>
                <option value="detail">Detail</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Media Type
              </label>
              <select
                value={formData.mediaType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mediaType: e.target.value as CaseStudyMediaType,
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
          </div>

          {/* Asset URL */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Asset URL *
            </label>
            <input
              type="url"
              value={formData.assetUrl}
              onChange={(e) =>
                setFormData({ ...formData, assetUrl: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="https://..."
              required
            />
          </div>

          {/* Video-specific fields */}
          {formData.mediaType === 'video' && (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Video Link URL
                </label>
                <input
                  type="url"
                  value={formData.linkUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, linkUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  placeholder="https://youtube.com/... or https://vimeo.com/..."
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Thumbnail URL
                </label>
                <input
                  type="url"
                  value={formData.thumbnailUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, thumbnailUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  placeholder="https://..."
                />
              </div>
            </>
          )}

          {/* Title & Caption */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Caption</label>
            <input
              type="text"
              value={formData.caption}
              onChange={(e) =>
                setFormData({ ...formData, caption: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Order & Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Order</label>
              <input
                type="number"
                min="0"
                value={formData.order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    order: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Visibility
              </label>
              <select
                value={formData.visibility}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    visibility: e.target.value as 'public' | 'internal',
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
            >
              {visual ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Logo Editor Modal
// ============================================================================

interface LogoEditorModalProps {
  logo: ClientLogoType | null;
  onSave: (logo: ClientLogoType) => void;
  onClose: () => void;
}

function LogoEditorModal({ logo, onSave, onClose }: LogoEditorModalProps) {
  const [formData, setFormData] = useState<Partial<ClientLogoType>>({
    assetUrl: logo?.assetUrl || '',
    fallbackUrl: logo?.fallbackUrl || '',
    alt: logo?.alt || '',
    theme: logo?.theme || undefined,
    variant: logo?.variant || undefined,
    visibility: logo?.visibility || 'public',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetUrl || !formData.alt) return;
    onSave(formData as ClientLogoType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">
          {logo ? 'Edit Client Logo' : 'Add Client Logo'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Asset URL */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Logo URL *
            </label>
            <input
              type="url"
              value={formData.assetUrl}
              onChange={(e) =>
                setFormData({ ...formData, assetUrl: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="https://..."
              required
            />
          </div>

          {/* Fallback URL */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Fallback URL
            </label>
            <input
              type="url"
              value={formData.fallbackUrl}
              onChange={(e) =>
                setFormData({ ...formData, fallbackUrl: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="https://... (optional, for dark mode or SVG fallback)"
            />
          </div>

          {/* Alt text */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Alt Text *
            </label>
            <input
              type="text"
              value={formData.alt}
              onChange={(e) =>
                setFormData({ ...formData, alt: e.target.value })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              placeholder="Client name logo"
              required
            />
          </div>

          {/* Theme & Variant */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Theme</label>
              <select
                value={formData.theme || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    theme:
                      (e.target.value as 'light' | 'dark' | undefined) ||
                      undefined,
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">Not specified</option>
                <option value="light">Light background</option>
                <option value="dark">Dark background</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Variant
              </label>
              <select
                value={formData.variant || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    variant:
                      (e.target.value as 'full' | 'mark' | undefined) ||
                      undefined,
                  })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">Not specified</option>
                <option value="full">Full wordmark</option>
                <option value="mark">Logo mark only</option>
              </select>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Visibility
            </label>
            <select
              value={formData.visibility}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  visibility: e.target.value as 'public' | 'internal',
                })
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="public">Public</option>
              <option value="internal">Internal</option>
            </select>
          </div>

          {/* Preview */}
          {formData.assetUrl && (
            <div className="p-4 bg-slate-800 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">Preview:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={formData.assetUrl}
                alt={formData.alt || 'Preview'}
                className="h-12 max-w-[160px] object-contain"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
            >
              {logo ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
