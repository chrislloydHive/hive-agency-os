'use client';

// app/c/[companyId]/brain/map/MapToolbar.tsx
// Strategic Map 2.0 Toolbar
//
// Features:
// - Heatmap toggle
// - Focus mode toggle
// - AI analysis buttons (Explain, Gaps, Opportunities)
// - Reset layout
// - Timeline slider
// - Zoom controls

import { useState } from 'react';
import {
  Map,
  Thermometer,
  Focus,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  RotateCcw,
  Clock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  X,
  ChevronDown,
  Activity,
} from 'lucide-react';
import { useStrategicMap } from './StrategicMapContext';
import { ModeSwitcher } from './ModeSwitcher';

// ============================================================================
// Types
// ============================================================================

interface MapToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onCenterMap: () => void;
  onResetLayout: () => void;
  nodeCount: number;
  ghostCount: number;
}

// ============================================================================
// AI Analysis Panel
// ============================================================================

function AIAnalysisPanel() {
  const { aiAnalysis, clearAIAnalysis } = useStrategicMap();

  if (!aiAnalysis.result && !aiAnalysis.error) return null;

  const result = aiAnalysis.result as any;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 mx-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-xl shadow-2xl z-50 max-h-[60vh] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-slate-200">
            {aiAnalysis.type === 'explain' && 'Strategic Analysis'}
            {aiAnalysis.type === 'gaps' && 'Gap Analysis'}
            {aiAnalysis.type === 'opportunities' && 'Opportunity Analysis'}
          </span>
        </div>
        <button
          onClick={clearAIAnalysis}
          className="p-1 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto max-h-[50vh]">
        {aiAnalysis.error ? (
          <p className="text-red-400 text-sm">{aiAnalysis.error}</p>
        ) : aiAnalysis.type === 'explain' && result ? (
          <div className="space-y-4">
            {/* Narrative */}
            <div>
              <p className="text-sm text-slate-300 leading-relaxed">{result.narrative}</p>
            </div>

            {/* Sections */}
            {result.sections?.map((section: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
                  section.type === 'strength' ? 'bg-emerald-500/10 border-emerald-500/30' :
                  section.type === 'weakness' ? 'bg-red-500/10 border-red-500/30' :
                  section.type === 'opportunity' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-violet-500/10 border-violet-500/30'
                }`}
              >
                <h4 className="text-xs font-medium text-slate-300 mb-1">{section.title}</h4>
                <p className="text-xs text-slate-400">{section.content}</p>
              </div>
            ))}

            {/* Key Takeaways */}
            {result.keyTakeaways?.length > 0 && (
              <div className="pt-3 border-t border-slate-800">
                <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Key Takeaways</h4>
                <ul className="space-y-1.5">
                  {result.keyTakeaways.map((takeaway: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-amber-400 mt-0.5">•</span>
                      {takeaway}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : aiAnalysis.type === 'gaps' && result ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">{result.summary}</p>
            {result.gaps?.map((gap: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
                  gap.severity === 'high' ? 'bg-red-500/10 border-red-500/30' :
                  gap.severity === 'medium' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-slate-500/10 border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300">{gap.nodeLabel}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    gap.severity === 'high' ? 'bg-red-500/30 text-red-400' :
                    gap.severity === 'medium' ? 'bg-amber-500/30 text-amber-400' :
                    'bg-slate-600 text-slate-400'
                  }`}>
                    {gap.severity}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">{gap.message}</p>
                <p className="text-xs text-emerald-400">→ {gap.recommendedFix}</p>
              </div>
            ))}
          </div>
        ) : aiAnalysis.type === 'opportunities' && result ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">{result.summary}</p>
            {result.opportunities?.map((opp: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300">{opp.title}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      opp.impactLevel === 'high' ? 'bg-emerald-500/30 text-emerald-400' :
                      opp.impactLevel === 'medium' ? 'bg-amber-500/30 text-amber-400' :
                      'bg-slate-600 text-slate-400'
                    }`}>
                      {opp.impactLevel} impact
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      opp.effortLevel === 'low' ? 'bg-emerald-500/30 text-emerald-400' :
                      opp.effortLevel === 'medium' ? 'bg-amber-500/30 text-amber-400' :
                      'bg-red-500/30 text-red-400'
                    }`}>
                      {opp.effortLevel} effort
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-2">{opp.description}</p>
                <div className="text-xs text-slate-500">
                  <strong>Steps:</strong> {opp.actionSteps?.slice(0, 2).join(' → ')}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MapToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onCenterMap,
  onResetLayout,
  nodeCount,
  ghostCount,
}: MapToolbarProps) {
  const {
    showHeatmap,
    setShowHeatmap,
    focusMode,
    exitFocusMode,
    aiAnalysis,
    runAIAnalysis,
    timelinePosition,
    setTimelinePosition,
    availableSnapshots,
  } = useStrategicMap();

  const [showAIMenu, setShowAIMenu] = useState(false);

  return (
    <div className="relative flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-slate-900/40">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-slate-200">Strategic Map</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
          <Activity className="w-3 h-3" />
          <span>{nodeCount} nodes</span>
          {ghostCount > 0 && (
            <>
              <span className="text-slate-700">·</span>
              <span>{ghostCount} gaps</span>
            </>
          )}
        </div>
      </div>

      {/* Center Section - Mode Switcher */}
      <div className="flex items-center gap-2">
        <ModeSwitcher />
      </div>

      {/* Right Section - Controls */}
      <div className="flex items-center gap-1">
        {/* Heatmap Toggle */}
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`p-1.5 rounded transition-colors ${
            showHeatmap
              ? 'bg-amber-500/20 text-amber-400'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
          }`}
          title="Toggle heatmap"
        >
          <Thermometer className="w-4 h-4" />
        </button>

        {/* Focus Mode Toggle */}
        <button
          onClick={focusMode.isActive ? exitFocusMode : undefined}
          disabled={!focusMode.isActive}
          className={`p-1.5 rounded transition-colors ${
            focusMode.isActive
              ? 'bg-violet-500/20 text-violet-400'
              : 'text-slate-500 cursor-not-allowed'
          }`}
          title={focusMode.isActive ? 'Exit focus mode' : 'Double-click node for focus mode'}
        >
          <Focus className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-700/50 mx-1" />

        {/* AI Analysis Buttons */}
        <div className="relative">
          <button
            onClick={() => setShowAIMenu(!showAIMenu)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded transition-colors ${
              aiAnalysis.isLoading || aiAnalysis.result
                ? 'bg-violet-500/20 text-violet-400'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            {aiAnalysis.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span className="text-xs hidden sm:inline">AI</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showAIMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowAIMenu(false)}
              />
              <div className="absolute top-full right-0 mt-1 w-48 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    runAIAnalysis('explain');
                    setShowAIMenu(false);
                  }}
                  disabled={aiAnalysis.isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Explain Map
                </button>
                <button
                  onClick={() => {
                    runAIAnalysis('gaps');
                    setShowAIMenu(false);
                  }}
                  disabled={aiAnalysis.isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 disabled:opacity-50"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Identify Gaps
                </button>
                <button
                  onClick={() => {
                    runAIAnalysis('opportunities');
                    setShowAIMenu(false);
                  }}
                  disabled={aiAnalysis.isLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 disabled:opacity-50"
                >
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Find Opportunities
                </button>
              </div>
            </>
          )}
        </div>

        {/* Reset Layout */}
        <button
          onClick={onResetLayout}
          className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded transition-colors"
          title="Reset layout"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-slate-700/50 mx-1" />

        {/* Timeline Slider */}
        {availableSnapshots > 0 && (
          <div className="flex items-center gap-2 px-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="range"
              min={-availableSnapshots}
              max={0}
              value={timelinePosition}
              onChange={(e) => setTimelinePosition(Number(e.target.value))}
              className="w-20 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400"
            />
            <span className="text-[10px] text-slate-500 w-8">
              {timelinePosition === 0 ? 'Now' : `${-timelinePosition}`}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="w-px h-4 bg-slate-700/50 mx-1" />

        {/* Zoom Controls */}
        <button
          onClick={onZoomOut}
          className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded transition-colors"
          title="Zoom out (−)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={onResetZoom}
          className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-400 hover:bg-slate-800/50 rounded transition-colors min-w-[48px] text-center"
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded transition-colors"
          title="Zoom in (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={onCenterMap}
          className="p-1.5 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 rounded transition-colors"
          title="Center map"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* AI Analysis Panel */}
      <AIAnalysisPanel />
    </div>
  );
}
