'use client';
// Cmd+K command bar — cross-system search across personal tasks, PM OS projects,
// and PM OS tasks. Opens as a modal overlay, returns results as you type.

import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, X, Loader2, ListTodo, FolderKanban, ClipboardList } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'task' | 'pmos-project' | 'pmos-task';
  title: string;
  subtitle: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  meta: Record<string, string | null>;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface CommandBarProps {
  /** Called when the user selects a personal task (opens it in the edit panel). */
  onSelectTask?: (taskId: string) => void;
  /** Called when the user selects a PM OS project. */
  onSelectProject?: (projectName: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<SearchResult['type'], string> = {
  'task': 'My Day',
  'pmos-project': 'PM OS Project',
  'pmos-task': 'PM OS Task',
};

const TYPE_ICON: Record<SearchResult['type'], typeof ListTodo> = {
  'task': ListTodo,
  'pmos-project': FolderKanban,
  'pmos-task': ClipboardList,
};

function statusDotColor(status: string | null): string {
  if (!status) return 'bg-gray-600';
  const s = status.toLowerCase();
  if (s.includes('done') || s.includes('complete') || s.includes('reviewed')) return 'bg-emerald-400';
  if (s.includes('progress') || s.includes('active') || s === 'next') return 'bg-sky-400';
  if (s.includes('blocked')) return 'bg-red-400';
  if (s.includes('waiting')) return 'bg-amber-400';
  return 'bg-gray-600';
}

function priorityBadge(p: string | null): string | null {
  if (!p) return null;
  return p;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CommandBar({ onSelectTask, onSelectProject }: CommandBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIdx(0);
      // Small delay so the DOM is painted
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = window.setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/os/search?q=${encodeURIComponent(q)}&limit=15`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then(res => {
          if (!res.ok) throw new Error(`Search failed: ${res.status}`);
          return res.json() as Promise<{ results: SearchResult[] }>;
        })
        .then(data => {
          setResults(data.results);
          setSelectedIdx(0);
        })
        .catch(err => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          console.error('[CommandBar] search error:', err);
        })
        .finally(() => setLoading(false));
    }, 200);
  }, []);

  useEffect(() => {
    doSearch(query);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      handleSelect(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }, [results, selectedIdx]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    if (result.type === 'task') {
      onSelectTask?.(result.id);
    } else if (result.type === 'pmos-project') {
      onSelectProject?.(result.title);
    } else if (result.type === 'pmos-task') {
      // For PM OS tasks, open the parent project if we have it
      if (result.meta.project) {
        onSelectProject?.(result.meta.project);
      }
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 transition-colors text-sm text-gray-500"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search tasks, projects…</span>
        <kbd className="ml-2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-600 font-mono">⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-x-0 top-[15%] z-[61] mx-auto w-full max-w-lg px-4">
        <div className="rounded-xl border border-white/15 bg-[#111] shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
            {loading
              ? <Loader2 className="w-4 h-4 text-gray-500 animate-spin shrink-0" />
              : <Search className="w-4 h-4 text-gray-500 shrink-0" />
            }
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, PM OS projects, team tasks…"
              className="flex-1 bg-transparent text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-white/5 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {query.length < 2 && (
              <div className="px-4 py-6 text-center text-xs text-gray-600">
                Type at least 2 characters to search across My Day, PM OS projects, and team tasks
              </div>
            )}

            {query.length >= 2 && !loading && results.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-gray-600">
                No results for &quot;{query}&quot;
              </div>
            )}

            {results.length > 0 && (
              <div className="py-1">
                {results.map((r, idx) => {
                  const Icon = TYPE_ICON[r.type];
                  const pb = priorityBadge(r.priority);
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      type="button"
                      onClick={() => handleSelect(r)}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx === selectedIdx ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-200 truncate">{r.title}</span>
                          {pb && (
                            <span className={`text-[10px] px-1 py-0.5 rounded bg-white/5 shrink-0 ${
                              pb === 'P0' || pb === 'High' ? 'text-red-400' :
                              pb === 'P1' || pb === 'Medium' ? 'text-amber-400' :
                              'text-gray-500'
                            }`}>{pb}</span>
                          )}
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor(r.status)}`} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-600">{TYPE_LABEL[r.type]}</span>
                          {r.subtitle && (
                            <>
                              <span className="text-[10px] text-gray-700">·</span>
                              <span className="text-[10px] text-gray-500 truncate">{r.subtitle}</span>
                            </>
                          )}
                          {r.dueDate && (
                            <>
                              <span className="text-[10px] text-gray-700">·</span>
                              <span className="text-[10px] text-gray-600">{r.dueDate}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-[10px] text-gray-700">
            <span><kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono">↵</kbd> open</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/10 font-mono">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </>
  );
}
