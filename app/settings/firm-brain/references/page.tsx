'use client';

// app/settings/firm-brain/references/page.tsx
// Client References Management

import { useState, useEffect, useCallback } from 'react';
import { Star, Plus, Trash2, Save, Search, ChevronRight, Loader2 } from 'lucide-react';
import type { Reference } from '@/lib/types/firmBrain';

export default function ReferencesPage() {
  const [references, setReferences] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedRef, setEditedRef] = useState<Reference | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchReferences = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/references');
      if (response.ok) {
        const data = await response.json();
        setReferences(data.references || []);
      }
    } catch (err) {
      console.error('Failed to fetch references:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferences();
  }, [fetchReferences]);

  useEffect(() => {
    const ref = references.find(r => r.id === selectedId);
    setEditedRef(ref ? { ...ref } : null);
  }, [selectedId, references]);

  const handleCreate = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: 'New Client',
          contactName: 'Contact Name',
          email: '',
          phone: '',
          engagementType: '',
          industries: [],
          permissionStatus: 'pending',
          notes: '',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setReferences(prev => [...prev, data.reference]);
        setSelectedId(data.reference.id);
      }
    } catch (err) {
      console.error('Failed to create reference:', err);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!editedRef) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/settings/firm-brain/references/${editedRef.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedRef),
      });
      if (response.ok) {
        const data = await response.json();
        setReferences(prev => prev.map(r => r.id === editedRef.id ? data.reference : r));
      }
    } catch (err) {
      console.error('Failed to save reference:', err);
    } finally {
      setSaving(false);
    }
  }, [editedRef]);

  const handleDelete = useCallback(async () => {
    if (!editedRef || !confirm('Delete this reference?')) return;
    const response = await fetch(`/api/settings/firm-brain/references/${editedRef.id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      setReferences(prev => prev.filter(r => r.id !== editedRef.id));
      setSelectedId(null);
    }
  }, [editedRef]);

  const filteredRefs = references.filter(r =>
    r.client.toLowerCase().includes(search.toLowerCase()) ||
    r.contactName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Star className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Client References</h1>
            <p className="text-sm text-slate-400">Contacts who can vouch for your work</p>
          </div>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      <div className="flex gap-6">
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
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
            ) : filteredRefs.length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-sm text-slate-500">No references yet</p></div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredRefs.map((ref) => (
                  <button
                    key={ref.id}
                    onClick={() => setSelectedId(ref.id)}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-800/50 transition-colors ${selectedId === ref.id ? 'bg-slate-800/70' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedId === ref.id ? 'text-white' : 'text-slate-300'}`}>{ref.client}</p>
                      <p className="text-xs text-slate-500 truncate">{ref.contactName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {ref.permissionStatus === 'confirmed' && <span className="text-xs text-emerald-400">Confirmed</span>}
                      <ChevronRight className={`w-4 h-4 ${selectedId === ref.id ? 'text-purple-400' : 'text-slate-600'}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {editedRef ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Client *</label>
                  <input type="text" value={editedRef.client} onChange={(e) => setEditedRef(prev => prev ? { ...prev, client: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Contact Name *</label>
                  <input type="text" value={editedRef.contactName} onChange={(e) => setEditedRef(prev => prev ? { ...prev, contactName: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input type="email" value={editedRef.email || ''} onChange={(e) => setEditedRef(prev => prev ? { ...prev, email: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Phone</label>
                  <input type="tel" value={editedRef.phone || ''} onChange={(e) => setEditedRef(prev => prev ? { ...prev, phone: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Engagement Type</label>
                  <input type="text" value={editedRef.engagementType || ''} onChange={(e) => setEditedRef(prev => prev ? { ...prev, engagementType: e.target.value } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="e.g., Strategy, Ongoing Retainer" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Permission Status</label>
                  <select value={editedRef.permissionStatus} onChange={(e) => setEditedRef(prev => prev ? { ...prev, permissionStatus: e.target.value as Reference['permissionStatus'] } : null)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea value={editedRef.notes || ''} onChange={(e) => setEditedRef(prev => prev ? { ...prev, notes: e.target.value } : null)} rows={3} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none" placeholder="What can this reference speak to?" />
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
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center"><p className="text-slate-500">Select a reference to edit or create a new one</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
