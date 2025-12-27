'use client';

// app/settings/firm-brain/pricing/page.tsx
// Pricing Templates Management

import { useState, useEffect, useCallback } from 'react';
import { DollarSign, Plus, Trash2, Save, Search, ChevronRight, Loader2 } from 'lucide-react';
import type { PricingTemplate } from '@/lib/types/firmBrain';

export default function PricingTemplatesPage() {
  const [templates, setTemplates] = useState<PricingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<PricingTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/pricing-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.pricingTemplates || []);
      }
    } catch (err) {
      console.error('Failed to fetch pricing templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  useEffect(() => {
    const template = templates.find(t => t.id === selectedId);
    setEditedTemplate(template ? { ...template } : null);
  }, [selectedId, templates]);

  const handleCreate = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/pricing-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateName: 'New Pricing Template',
          useCase: '',
          lineItems: [],
          assumptions: [],
          exclusions: [],
          optionSets: [],
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(prev => [...prev, data.pricingTemplate]);
        setSelectedId(data.pricingTemplate.id);
      }
    } catch (err) {
      console.error('Failed to create pricing template:', err);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!editedTemplate) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/settings/firm-brain/pricing-templates/${editedTemplate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedTemplate),
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(prev => prev.map(t => t.id === editedTemplate.id ? data.pricingTemplate : t));
      }
    } catch (err) {
      console.error('Failed to save pricing template:', err);
    } finally {
      setSaving(false);
    }
  }, [editedTemplate]);

  const handleDelete = useCallback(async () => {
    if (!editedTemplate || !confirm('Delete this pricing template?')) return;
    const response = await fetch(`/api/settings/firm-brain/pricing-templates/${editedTemplate.id}`, { method: 'DELETE' });
    if (response.ok) {
      setTemplates(prev => prev.filter(t => t.id !== editedTemplate.id));
      setSelectedId(null);
    }
  }, [editedTemplate]);

  const filteredTemplates = templates.filter(t =>
    t.templateName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg"><DollarSign className="w-5 h-5 text-purple-400" /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Pricing Templates</h1>
            <p className="text-sm text-slate-400">Reusable pricing structures for proposals</p>
          </div>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />Add New
        </button>
      </div>

      <div className="flex gap-6">
        <div className="w-80 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
            ) : filteredTemplates.length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-sm text-slate-500">No pricing templates yet</p></div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredTemplates.map((template) => (
                  <button key={template.id} onClick={() => setSelectedId(template.id)} className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-800/50 transition-colors ${selectedId === template.id ? 'bg-slate-800/70' : ''}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedId === template.id ? 'text-white' : 'text-slate-300'}`}>{template.templateName}</p>
                      <p className="text-xs text-slate-500 truncate">{template.useCase || 'General'}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${selectedId === template.id ? 'text-purple-400' : 'text-slate-600'}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {editedTemplate ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Template Name *</label>
                <input type="text" value={editedTemplate.templateName} onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, templateName: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Use Case</label>
                <input type="text" value={editedTemplate.useCase || ''} onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, useCase: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="e.g., Strategy Project, Retainer" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Assumptions (one per line)</label>
                <textarea value={(editedTemplate.assumptions || []).join('\n')} onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, assumptions: e.target.value.split('\n').filter(Boolean) } : null)} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none" placeholder="List pricing assumptions..." />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Exclusions (one per line)</label>
                <textarea value={(editedTemplate.exclusions || []).join('\n')} onChange={(e) => setEditedTemplate(prev => prev ? { ...prev, exclusions: e.target.value.split('\n').filter(Boolean) } : null)} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none" placeholder="List what's not included..." />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" />Delete</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium rounded-lg transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center"><p className="text-slate-500">Select a template to edit or create a new one</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
