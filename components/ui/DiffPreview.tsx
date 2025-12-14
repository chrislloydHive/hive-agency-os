// components/ui/DiffPreview.tsx
// Lightweight line-based diff preview for markdown content
//
// Shows additions (green) and removals (red) between original and suggested content.
// Designed for Strategy Artifact Copilot to preview AI suggestions.

'use client';

import React from 'react';
import { Plus, Minus, Equal } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type DiffLineType = 'added' | 'removed' | 'unchanged';

interface DiffLine {
  type: DiffLineType;
  content: string;
  lineNumber?: number;
}

interface DiffPreviewProps {
  original: string;
  suggested: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
}

// ============================================================================
// Simple LCS-based Diff Algorithm
// ============================================================================

function computeDiff(original: string, suggested: string): DiffLine[] {
  const originalLines = original.split('\n');
  const suggestedLines = suggested.split('\n');

  // Build LCS table
  const m = originalLines.length;
  const n = suggestedLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalLines[i - 1] === suggestedLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === suggestedLines[j - 1]) {
      result.unshift({
        type: 'unchanged',
        content: originalLines[i - 1],
        lineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        content: suggestedLines[j - 1],
        lineNumber: j,
      });
      j--;
    } else if (i > 0) {
      result.unshift({
        type: 'removed',
        content: originalLines[i - 1],
        lineNumber: i,
      });
      i--;
    }
  }

  return result;
}

// ============================================================================
// Component
// ============================================================================

export function DiffPreview({
  original,
  suggested,
  maxHeight = '400px',
  showLineNumbers = true,
}: DiffPreviewProps) {
  const diffLines = computeDiff(original, suggested);

  // Stats
  const added = diffLines.filter(l => l.type === 'added').length;
  const removed = diffLines.filter(l => l.type === 'removed').length;

  if (added === 0 && removed === 0) {
    return (
      <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg text-center">
        <Equal className="w-5 h-5 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No changes detected</p>
      </div>
    );
  }

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      {/* Stats header */}
      <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700/50 flex items-center gap-4">
        <span className="text-xs text-slate-400">Changes:</span>
        {added > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Plus className="w-3 h-3" />
            {added} added
          </span>
        )}
        {removed > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-red-400">
            <Minus className="w-3 h-3" />
            {removed} removed
          </span>
        )}
      </div>

      {/* Diff content */}
      <div
        className="overflow-auto font-mono text-sm"
        style={{ maxHeight }}
      >
        {diffLines.map((line, idx) => (
          <DiffLineRow
            key={idx}
            line={line}
            showLineNumber={showLineNumbers}
          />
        ))}
      </div>
    </div>
  );
}

function DiffLineRow({
  line,
  showLineNumber,
}: {
  line: DiffLine;
  showLineNumber: boolean;
}) {
  const bgClass = {
    added: 'bg-emerald-500/10',
    removed: 'bg-red-500/10',
    unchanged: '',
  }[line.type];

  const textClass = {
    added: 'text-emerald-300',
    removed: 'text-red-300 line-through',
    unchanged: 'text-slate-300',
  }[line.type];

  const iconClass = {
    added: 'text-emerald-500',
    removed: 'text-red-500',
    unchanged: 'text-slate-600',
  }[line.type];

  const Icon = {
    added: Plus,
    removed: Minus,
    unchanged: () => <span className="w-3 h-3 inline-block" />,
  }[line.type];

  return (
    <div className={`flex ${bgClass} border-b border-slate-800/50 last:border-b-0`}>
      {showLineNumber && (
        <div className="w-10 px-2 py-1 text-right text-xs text-slate-600 select-none bg-slate-900/50">
          {line.lineNumber || ''}
        </div>
      )}
      <div className={`w-6 px-1 py-1 flex items-center justify-center ${iconClass}`}>
        <Icon className="w-3 h-3" />
      </div>
      <pre className={`flex-1 px-2 py-1 whitespace-pre-wrap break-words ${textClass}`}>
        {line.content || ' '}
      </pre>
    </div>
  );
}

// ============================================================================
// Side-by-Side Preview (Alternative View)
// ============================================================================

export function SideBySidePreview({
  original,
  suggested,
  maxHeight = '400px',
}: {
  original: string;
  suggested: string;
  maxHeight?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2" style={{ maxHeight }}>
      {/* Original */}
      <div className="border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-red-500/10 border-b border-slate-700/50">
          <span className="text-xs font-medium text-red-400">Current</span>
        </div>
        <pre className="p-3 text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-auto bg-slate-900/30">
          {original || '(empty)'}
        </pre>
      </div>

      {/* Suggested */}
      <div className="border border-slate-700/50 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-emerald-500/10 border-b border-slate-700/50">
          <span className="text-xs font-medium text-emerald-400">Suggested</span>
        </div>
        <pre className="p-3 text-sm text-slate-300 font-mono whitespace-pre-wrap overflow-auto bg-slate-900/30">
          {suggested || '(empty)'}
        </pre>
      </div>
    </div>
  );
}

export default DiffPreview;
