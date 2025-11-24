// components/os/diagnostics/FilterBar.tsx
// Filter Bar Component

'use client';

import type { ActionFilters, ServiceArea } from '@/lib/diagnostics/types';
import { getServiceAreaLabel } from '@/lib/diagnostics/types';

type Props = {
  filters: ActionFilters;
  filterOptions: {
    tags: string[];
    personas: string[];
    serviceAreas: ServiceArea[];
    playbooks: string[];
  };
  onFiltersChange: (filters: ActionFilters) => void;
};

export function FilterBar({ filters, filterOptions, onFiltersChange }: Props) {
  const updateFilter = (key: keyof ActionFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-4">
      {/* Service Area Filter */}
      {filterOptions.serviceAreas.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-400">Service Area</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilter('serviceArea', undefined)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                !filters.serviceArea
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {filterOptions.serviceAreas.map((area) => (
              <button
                key={area}
                onClick={() => updateFilter('serviceArea', area)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  filters.serviceArea === area
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {getServiceAreaLabel(area)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playbook Filter */}
      {filterOptions.playbooks.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-400">Playbook</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilter('playbook', undefined)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                !filters.playbook
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {filterOptions.playbooks.map((playbook) => (
              <button
                key={playbook}
                onClick={() => updateFilter('playbook', playbook)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  filters.playbook === playbook
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {playbook}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Persona Filter */}
      {filterOptions.personas.length > 0 && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-400">Persona</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilter('persona', undefined)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                !filters.persona
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {filterOptions.personas.map((persona) => (
              <button
                key={persona}
                onClick={() => updateFilter('persona', persona)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  filters.persona === persona
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {persona}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-400">Search</label>
        <input
          type="text"
          placeholder="Search actions..."
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value || undefined)}
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
