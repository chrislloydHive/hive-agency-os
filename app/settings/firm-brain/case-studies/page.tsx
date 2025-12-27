'use client';

// app/settings/firm-brain/case-studies/page.tsx
// Case Studies Management

import { useState, useEffect, useCallback } from 'react';
import { Briefcase, Plus, Trash2, Save, Search, ChevronRight, Loader2 } from 'lucide-react';
import type { CaseStudy } from '@/lib/types/firmBrain';

export default function CaseStudiesPage() {
  const [studies, setStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedStudy, setEditedStudy] = useState<CaseStudy | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchStudies = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/case-studies');
      if (response.ok) {
        const data = await response.json();
        setStudies(data.caseStudies || []);
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
    const study = studies.find(s => s.id === selectedId);
    setEditedStudy(study ? { ...study } : null);
  }, [selectedId, studies]);

  const handleCreate = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/case-studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Case Study',
          client: 'Client Name',
          summary: '',
          problem: '',
          approach: '',
          outcome: '',
          industry: '',
          services: [],
          metrics: [],
          permissionLevel: 'internal',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setStudies(prev => [...prev, data.caseStudy]);
        setSelectedId(data.caseStudy.id);
      }
    } catch (err) {
      console.error('Failed to create case study:', err);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!editedStudy) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/settings/firm-brain/case-studies/${editedStudy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedStudy),
      });
      if (response.ok) {
        const data = await response.json();
        setStudies(prev => prev.map(s => s.id === editedStudy.id ? data.caseStudy : s));
      }
    } catch (err) {
      console.error('Failed to save case study:', err);
    } finally {
      setSaving(false);
    }
  }, [editedStudy]);

  const handleDelete = useCallback(async () => {
    if (!editedStudy || !confirm('Delete this case study?')) return;
    const response = await fetch(`/api/settings/firm-brain/case-studies/${editedStudy.id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      setStudies(prev => prev.filter(s => s.id !== editedStudy.id));
      setSelectedId(null);
    }
  }, [editedStudy]);

  const filteredStudies = studies.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.client.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Briefcase className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Case Studies</h1>
            <p className="text-sm text-slate-400">Portfolio work and client outcomes</p>
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
        {/* List */}
        <div className="w-80 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : filteredStudies.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500">No case studies yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredStudies.map((study) => (
                  <button
                    key={study.id}
                    onClick={() => setSelectedId(study.id)}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-800/50 transition-colors ${
                      selectedId === study.id ? 'bg-slate-800/70' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedId === study.id ? 'text-white' : 'text-slate-300'}`}>
                        {study.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{study.client}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${selectedId === study.id ? 'text-purple-400' : 'text-slate-600'}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {editedStudy ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Title *</label>
                  <input
                    type="text"
                    value={editedStudy.title}
                    onChange={(e) => setEditedStudy(prev => prev ? { ...prev, title: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Client *</label>
                  <input
                    type="text"
                    value={editedStudy.client}
                    onChange={(e) => setEditedStudy(prev => prev ? { ...prev, client: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Industry</label>
                  <input
                    type="text"
                    value={editedStudy.industry || ''}
                    onChange={(e) => setEditedStudy(prev => prev ? { ...prev, industry: e.target.value } : null)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Permission Level</label>
                  <select
                    value={editedStudy.permissionLevel}
                    onChange={(e) => setEditedStudy(prev => prev ? { ...prev, permissionLevel: e.target.value as CaseStudy['permissionLevel'] } : null)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="public">Public</option>
                    <option value="internal">Internal Only</option>
                    <option value="nda">NDA Protected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Summary</label>
                <textarea
                  value={editedStudy.summary || ''}
                  onChange={(e) => setEditedStudy(prev => prev ? { ...prev, summary: e.target.value } : null)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  placeholder="Brief overview..."
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Problem</label>
                <textarea
                  value={editedStudy.problem || ''}
                  onChange={(e) => setEditedStudy(prev => prev ? { ...prev, problem: e.target.value } : null)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  placeholder="What challenge did the client face?"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Approach</label>
                <textarea
                  value={editedStudy.approach || ''}
                  onChange={(e) => setEditedStudy(prev => prev ? { ...prev, approach: e.target.value } : null)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  placeholder="How did you solve it?"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Outcome</label>
                <textarea
                  value={editedStudy.outcome || ''}
                  onChange={(e) => setEditedStudy(prev => prev ? { ...prev, outcome: e.target.value } : null)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  placeholder="What were the results?"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium rounded-lg transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
              <p className="text-slate-500">Select a case study to edit or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
