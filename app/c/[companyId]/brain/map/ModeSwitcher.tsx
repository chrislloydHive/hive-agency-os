'use client';

// app/c/[companyId]/brain/map/ModeSwitcher.tsx
// Enhanced Mode Switcher for Strategic Map 2.0
//
// Features:
// - Segmented control design with sliding indicator
// - Mode-specific icons and colors
// - Ghost nodes toggle with count
// - Smooth animations and transitions

import { useState, useRef, useEffect } from 'react';
import {
  Network,
  Lightbulb,
  Zap,
  Radar,
  Ghost,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import { useStrategicMap, type StrategicMapMode } from './StrategicMapContext';

// ============================================================================
// Icon & Color Mapping
// ============================================================================

const MODE_ICONS = {
  network: Network,
  lightbulb: Lightbulb,
  zap: Zap,
  radar: Radar,
} as const;

const MODE_COLORS: Record<StrategicMapMode, { bg: string; text: string; glow: string }> = {
  structure: { bg: 'bg-slate-500/20', text: 'text-slate-300', glow: 'shadow-slate-500/20' },
  insights: { bg: 'bg-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/30' },
  actions: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/30' },
  signals: { bg: 'bg-violet-500/20', text: 'text-violet-400', glow: 'shadow-violet-500/30' },
};

// ============================================================================
// Segmented Mode Switcher (Primary)
// ============================================================================

export function ModeSwitcher() {
  const {
    mode,
    setMode,
    modeConfigs,
    showGhostNodes,
    setShowGhostNodes,
    ghostNodes,
  } = useStrategicMap();

  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Calculate indicator position based on active mode
  useEffect(() => {
    if (!containerRef.current) return;
    const activeIndex = modeConfigs.findIndex(c => c.id === mode);
    const buttons = containerRef.current.querySelectorAll('[data-mode-button]');
    const activeButton = buttons[activeIndex] as HTMLElement;

    if (activeButton) {
      setIndicatorStyle({
        left: activeButton.offsetLeft,
        width: activeButton.offsetWidth,
      });
    }
  }, [mode, modeConfigs]);

  const currentColors = MODE_COLORS[mode];

  return (
    <div className="flex items-center gap-3">
      {/* Segmented Control */}
      <div
        ref={containerRef}
        className="relative flex items-center p-1 bg-slate-800/80 border border-slate-700/50 rounded-xl backdrop-blur-sm"
      >
        {/* Sliding indicator */}
        <div
          className={`absolute top-1 h-[calc(100%-8px)] rounded-lg transition-all duration-300 ease-out ${currentColors.bg} shadow-lg ${currentColors.glow}`}
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />

        {/* Mode buttons */}
        {modeConfigs.map(config => {
          const Icon = MODE_ICONS[config.icon];
          const isActive = config.id === mode;
          const colors = MODE_COLORS[config.id];

          return (
            <button
              key={config.id}
              data-mode-button
              onClick={() => setMode(config.id)}
              className={`relative z-10 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                isActive
                  ? colors.text
                  : 'text-slate-500 hover:text-slate-400'
              }`}
              title={config.description}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Ghost Nodes Toggle */}
      <button
        onClick={() => setShowGhostNodes(!showGhostNodes)}
        className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
          showGhostNodes
            ? 'bg-violet-500/15 border-violet-500/30 text-violet-400 shadow-lg shadow-violet-500/10'
            : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-400 hover:border-slate-600'
        }`}
        title={showGhostNodes ? 'Hide ghost nodes' : 'Show ghost nodes'}
      >
        <Ghost className={`w-4 h-4 ${showGhostNodes ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-medium">
          Gaps
        </span>
        {ghostNodes.length > 0 && (
          <span className={`min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full ${
            showGhostNodes
              ? 'bg-violet-400 text-slate-900'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {ghostNodes.length}
          </span>
        )}
        {showGhostNodes ? (
          <Eye className="w-3.5 h-3.5 opacity-60" />
        ) : (
          <EyeOff className="w-3.5 h-3.5 opacity-60" />
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Compact Variant (for tight spaces)
// ============================================================================

export function ModeSwitcherCompact() {
  const { mode, setMode, modeConfigs } = useStrategicMap();
  const currentColors = MODE_COLORS[mode];

  return (
    <div className="flex items-center gap-0.5 p-1 bg-slate-800/60 rounded-lg border border-slate-700/50">
      {modeConfigs.map(config => {
        const Icon = MODE_ICONS[config.icon];
        const isActive = config.id === mode;
        const colors = MODE_COLORS[config.id];

        return (
          <button
            key={config.id}
            onClick={() => setMode(config.id)}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-200 ${
              isActive
                ? `${colors.bg} ${colors.text} shadow-sm`
                : 'text-slate-500 hover:text-slate-400 hover:bg-slate-700/30'
            }`}
            title={`${config.label}: ${config.description}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Dropdown Variant (for mobile or overflow)
// ============================================================================

export function ModeSwitcherDropdown() {
  const {
    mode,
    setMode,
    modeConfigs,
    showGhostNodes,
    setShowGhostNodes,
    ghostNodes,
  } = useStrategicMap();

  const [isOpen, setIsOpen] = useState(false);

  const currentConfig = modeConfigs.find(c => c.id === mode)!;
  const CurrentIcon = MODE_ICONS[currentConfig.icon];
  const currentColors = MODE_COLORS[mode];

  return (
    <div className="flex items-center gap-2">
      {/* Mode Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-2 border rounded-xl transition-all duration-200 ${currentColors.bg} ${currentColors.text} border-slate-700/50 hover:border-slate-600`}
        >
          <CurrentIcon className="w-4 h-4" />
          <span className="text-sm font-medium">{currentConfig.label}</span>
          <ChevronDown className={`w-4 h-4 opacity-60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-xl z-50 overflow-hidden">
              {modeConfigs.map(config => {
                const Icon = MODE_ICONS[config.icon];
                const isActive = config.id === mode;
                const colors = MODE_COLORS[config.id];

                return (
                  <button
                    key={config.id}
                    onClick={() => {
                      setMode(config.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? `${colors.bg} border-l-2 ${colors.text.replace('text', 'border')}`
                        : 'hover:bg-slate-700/30 border-l-2 border-transparent'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 ${isActive ? colors.text : 'text-slate-400'}`} />
                    <div>
                      <p className={`text-sm font-medium ${isActive ? colors.text : 'text-slate-200'}`}>
                        {config.label}
                      </p>
                      <p className="text-xs text-slate-500">{config.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Ghost Toggle */}
      <button
        onClick={() => setShowGhostNodes(!showGhostNodes)}
        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border transition-all ${
          showGhostNodes
            ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
            : 'bg-slate-800/50 border-slate-700/50 text-slate-500 hover:text-slate-400'
        }`}
        title={showGhostNodes ? 'Hide ghost nodes' : 'Show ghost nodes'}
      >
        <Ghost className="w-4 h-4" />
        {ghostNodes.length > 0 && (
          <span className="text-xs font-medium">{ghostNodes.length}</span>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// Mode Indicator (for status bar / headers)
// ============================================================================

export function ModeIndicator() {
  const { mode, modeConfigs } = useStrategicMap();
  const currentConfig = modeConfigs.find(c => c.id === mode)!;
  const Icon = MODE_ICONS[currentConfig.icon];
  const colors = MODE_COLORS[mode];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${colors.bg}`}>
      <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
      <span className={`text-xs font-medium ${colors.text}`}>{currentConfig.label}</span>
    </div>
  );
}

// ============================================================================
// Mode Pills (alternative inline display)
// ============================================================================

export function ModePills() {
  const { mode, setMode, modeConfigs } = useStrategicMap();

  return (
    <div className="flex flex-wrap gap-2">
      {modeConfigs.map(config => {
        const Icon = MODE_ICONS[config.icon];
        const isActive = config.id === mode;
        const colors = MODE_COLORS[config.id];

        return (
          <button
            key={config.id}
            onClick={() => setMode(config.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              isActive
                ? `${colors.bg} ${colors.text} ring-1 ring-current/30`
                : 'bg-slate-800/40 text-slate-500 hover:text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
