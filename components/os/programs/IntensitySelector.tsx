'use client';

// components/os/programs/IntensitySelector.tsx
// Intensity Selector - Controls for viewing and changing program intensity
//
// Displays:
// - Current intensity badge
// - Change Intensity button
// - Opens confirmation modal on change

import { useState } from 'react';
import { Gauge, ChevronDown } from 'lucide-react';
import type { IntensityLevel } from '@/lib/types/programTemplate';
import { IntensityChangeModal } from './IntensityChangeModal';

// ============================================================================
// Types
// ============================================================================

interface IntensitySelectorProps {
  programId: string;
  programTitle: string;
  currentIntensity: IntensityLevel;
  isDisabled?: boolean;
  onIntensityChange?: (newIntensity: IntensityLevel) => void;
}

// ============================================================================
// Intensity Configuration
// ============================================================================

const INTENSITY_CONFIG: Record<IntensityLevel, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  Core: {
    label: 'Core',
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/30',
  },
  Standard: {
    label: 'Standard',
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
  },
  Aggressive: {
    label: 'Aggressive',
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/30',
  },
};

const INTENSITY_LEVELS: IntensityLevel[] = ['Core', 'Standard', 'Aggressive'];

// ============================================================================
// Main Component
// ============================================================================

export function IntensitySelector({
  programId,
  programTitle,
  currentIntensity,
  isDisabled = false,
  onIntensityChange,
}: IntensitySelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIntensity, setSelectedIntensity] = useState<IntensityLevel | null>(null);

  const config = INTENSITY_CONFIG[currentIntensity];

  // Handle intensity selection
  const handleSelectIntensity = (intensity: IntensityLevel) => {
    if (intensity === currentIntensity) {
      setIsDropdownOpen(false);
      return;
    }
    setSelectedIntensity(intensity);
    setIsDropdownOpen(false);
  };

  // Handle modal success
  const handleSuccess = (data: unknown) => {
    if (onIntensityChange && selectedIntensity) {
      onIntensityChange(selectedIntensity);
    }
    setSelectedIntensity(null);
  };

  return (
    <div className="relative">
      {/* Current Intensity Display with Dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-500">Intensity:</label>
        <div className="relative">
          <button
            onClick={() => !isDisabled && setIsDropdownOpen(!isDropdownOpen)}
            disabled={isDisabled}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors ${config.bg} ${config.border} ${
              isDisabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:opacity-80 cursor-pointer'
            }`}
          >
            <Gauge className={`w-3.5 h-3.5 ${config.color}`} />
            <span className={`text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
            {!isDisabled && (
              <ChevronDown className={`w-3.5 h-3.5 ${config.color} transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`} />
            )}
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDropdownOpen(false)}
              />

              {/* Menu */}
              <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[140px]">
                {INTENSITY_LEVELS.map(intensity => {
                  const itemConfig = INTENSITY_CONFIG[intensity];
                  const isSelected = intensity === currentIntensity;

                  return (
                    <button
                      key={intensity}
                      onClick={() => handleSelectIntensity(intensity)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-slate-700/50'
                          : 'hover:bg-slate-700/30'
                      }`}
                    >
                      <Gauge className={`w-3.5 h-3.5 ${itemConfig.color}`} />
                      <span className={itemConfig.color}>{itemConfig.label}</span>
                      {isSelected && (
                        <span className="ml-auto text-xs text-slate-500">Current</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {selectedIntensity && (
        <IntensityChangeModal
          programId={programId}
          programTitle={programTitle}
          currentIntensity={currentIntensity}
          newIntensity={selectedIntensity}
          isOpen={true}
          onClose={() => setSelectedIntensity(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}

export default IntensitySelector;
