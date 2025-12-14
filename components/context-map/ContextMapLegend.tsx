// components/context-map/ContextMapLegend.tsx
// Status and source legend for the Context Map

'use client';

import { Check, Sparkles, User, TestTube, FileInput, HelpCircle } from 'lucide-react';
import { ZONE_DEFINITIONS, COLORS } from './constants';

interface ContextMapLegendProps {
  compact?: boolean;
}

export function ContextMapLegend({ compact = false }: ContextMapLegendProps) {
  if (compact) {
    return (
      <div className="absolute top-4 left-4 flex items-center gap-3 px-3 py-2 bg-slate-900/90 rounded-lg border border-slate-800 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-emerald-500 bg-emerald-500/20" />
          <span className="text-slate-400">Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-dashed border-amber-500 bg-amber-500/10" />
          <span className="text-slate-400">Proposed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border border-dashed border-slate-500 bg-slate-500/10 opacity-50" />
          <span className="text-slate-500">Low conf</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 p-3 bg-slate-900/95 rounded-lg border border-slate-800 shadow-lg">
      <div className="text-xs font-medium text-slate-400 mb-2">Legend</div>

      {/* Status */}
      <div className="space-y-1.5 mb-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Status</div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-emerald-500" />
          </div>
          <span className="text-xs text-slate-300">Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-dashed border-amber-500 bg-amber-500/10 flex items-center justify-center">
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
          </div>
          <span className="text-xs text-slate-300">AI Proposed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border border-dashed border-slate-500 bg-slate-500/10 opacity-50 flex items-center justify-center">
            <HelpCircle className="w-2.5 h-2.5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-400">Low confidence</span>
        </div>
      </div>

      {/* Sources */}
      <div className="space-y-1.5 mb-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Source</div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-slate-400">AI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-cyan-400" />
            <span className="text-xs text-slate-400">User</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TestTube className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-slate-400">Lab</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FileInput className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">Import</span>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">Confidence</div>
        <div className="flex items-center gap-1">
          <div className="flex-1 h-1.5 rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Zones */}
      <div className="mt-3 pt-3 border-t border-slate-800">
        <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Zones</div>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(ZONE_DEFINITIONS).slice(0, 8).map(([id, zone]) => (
            <div key={id} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: zone.color }}
              />
              <span className="text-[10px] text-slate-400 truncate">{zone.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
