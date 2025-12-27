'use client';

// app/settings/firm-brain/team/page.tsx
// Team Members Management

import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, Save, Search, ChevronRight, Loader2 } from 'lucide-react';
import type { TeamMember } from '@/lib/types/firmBrain';

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedMember, setEditedMember] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/team-members');
      if (response.ok) {
        const data = await response.json();
        setMembers(data.teamMembers || []);
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    const member = members.find(m => m.id === selectedId);
    setEditedMember(member ? { ...member } : null);
  }, [selectedId, members]);

  const handleCreate = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/firm-brain/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'New Team Member',
          role: 'Role',
          bio: '',
          strengths: [],
          functions: [],
          availabilityStatus: 'available',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(prev => [...prev, data.teamMember]);
        setSelectedId(data.teamMember.id);
      }
    } catch (err) {
      console.error('Failed to create team member:', err);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!editedMember) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/settings/firm-brain/team-members/${editedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedMember),
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(prev => prev.map(m => m.id === editedMember.id ? data.teamMember : m));
      }
    } catch (err) {
      console.error('Failed to save team member:', err);
    } finally {
      setSaving(false);
    }
  }, [editedMember]);

  const handleDelete = useCallback(async () => {
    if (!editedMember || !confirm('Delete this team member?')) return;
    const response = await fetch(`/api/settings/firm-brain/team-members/${editedMember.id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      setMembers(prev => prev.filter(m => m.id !== editedMember.id));
      setSelectedId(null);
    }
  }, [editedMember]);

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg"><Users className="w-5 h-5 text-purple-400" /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Team Members</h1>
            <p className="text-sm text-slate-400">Your team&apos;s profiles for RFP responses</p>
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
            ) : filteredMembers.length === 0 ? (
              <div className="px-4 py-8 text-center"><p className="text-sm text-slate-500">No team members yet</p></div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filteredMembers.map((member) => (
                  <button key={member.id} onClick={() => setSelectedId(member.id)} className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-800/50 transition-colors ${selectedId === member.id ? 'bg-slate-800/70' : ''}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${selectedId === member.id ? 'text-white' : 'text-slate-300'}`}>{member.name}</p>
                      <p className="text-xs text-slate-500 truncate">{member.role}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${selectedId === member.id ? 'text-purple-400' : 'text-slate-600'}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {editedMember ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 space-y-4">
              <TeamMemberEditor member={editedMember} onUpdate={(updates) => setEditedMember(prev => prev ? { ...prev, ...updates } : null)} />
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" />Delete</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium rounded-lg transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center"><p className="text-slate-500">Select a team member to edit or create a new one</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamMemberEditor({
  member,
  onUpdate,
}: {
  member: TeamMember;
  onUpdate: (updates: Partial<TeamMember>) => void;
}) {
  const [strengthInput, setStrengthInput] = useState('');
  const [functionInput, setFunctionInput] = useState('');

  const addStrength = () => {
    if (!strengthInput.trim()) return;
    onUpdate({ strengths: [...(member.strengths || []), strengthInput.trim()] });
    setStrengthInput('');
  };

  const removeStrength = (index: number) => {
    onUpdate({ strengths: (member.strengths || []).filter((_, i) => i !== index) });
  };

  const addFunction = () => {
    if (!functionInput.trim()) return;
    onUpdate({ functions: [...(member.functions || []), functionInput.trim()] });
    setFunctionInput('');
  };

  const removeFunction = (index: number) => {
    onUpdate({ functions: (member.functions || []).filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Name *</label>
          <input
            type="text"
            value={member.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Role *</label>
          <input
            type="text"
            value={member.role}
            onChange={(e) => onUpdate({ role: e.target.value })}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Bio</label>
        <textarea
          value={member.bio || ''}
          onChange={(e) => onUpdate({ bio: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
          placeholder="Brief professional bio..."
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Availability</label>
        <select
          value={member.availabilityStatus}
          onChange={(e) => onUpdate({ availabilityStatus: e.target.value as TeamMember['availabilityStatus'] })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="available">Available</option>
          <option value="limited">Limited</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Strengths</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={strengthInput}
            onChange={(e) => setStrengthInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStrength()}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            placeholder="Add a strength..."
          />
          <button onClick={addStrength} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(member.strengths || []).map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-300 text-sm rounded-lg">
              {s}
              <button onClick={() => removeStrength(i)} className="text-emerald-400 hover:text-emerald-300">&times;</button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Functions</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={functionInput}
            onChange={(e) => setFunctionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFunction()}
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            placeholder="Add a function (e.g., Strategy, Creative)..."
          />
          <button onClick={addFunction} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(member.functions || []).map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-300 text-sm rounded-lg">
              {f}
              <button onClick={() => removeFunction(i)} className="text-blue-400 hover:text-blue-300">&times;</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
