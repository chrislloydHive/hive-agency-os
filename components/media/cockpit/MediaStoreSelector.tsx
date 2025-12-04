'use client';

// components/media/cockpit/MediaStoreSelector.tsx
// Store selector for multi-location companies
//
// Allows filtering cockpit data by individual store
// For single-location companies, this component renders nothing

import { useState, useRef, useEffect } from 'react';
import type { MediaStoreOption } from '@/lib/media/cockpit';

interface MediaStoreSelectorProps {
  stores: MediaStoreOption[];
  selectedStoreId: string | null;
  onChange: (storeId: string | null) => void;
  className?: string;
}

export function MediaStoreSelector({
  stores,
  selectedStoreId,
  onChange,
  className = '',
}: MediaStoreSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Don't render for single-location companies
  if (stores.length <= 1) {
    return null;
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter stores by search
  const filteredStores = stores.filter(
    (store) =>
      store.name.toLowerCase().includes(search.toLowerCase()) ||
      store.market?.toLowerCase().includes(search.toLowerCase()) ||
      store.storeCode?.toLowerCase().includes(search.toLowerCase())
  );

  // Get selected store label
  const selectedStore = stores.find((s) => s.id === selectedStoreId);
  const displayLabel = selectedStore ? selectedStore.name : 'All Stores';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
      >
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span className="text-xs font-medium text-slate-200 max-w-32 truncate">{displayLabel}</span>
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 right-0 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
          {/* Search input */}
          <div className="p-2 border-b border-slate-800">
            <input
              type="text"
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-slate-800/50 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              autoFocus
            />
          </div>

          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {/* All Stores option */}
            <button
              onClick={() => {
                onChange(null);
                setIsOpen(false);
                setSearch('');
              }}
              className={`w-full px-3 py-2 text-left hover:bg-slate-800/50 transition-colors flex items-center justify-between ${
                selectedStoreId === null ? 'bg-amber-500/10' : ''
              }`}
            >
              <span className="text-xs text-slate-200">All Stores</span>
              {selectedStoreId === null && (
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>

            {/* Divider */}
            <div className="border-t border-slate-800" />

            {/* Individual stores */}
            {filteredStores.map((store) => (
              <button
                key={store.id}
                onClick={() => {
                  onChange(store.id);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`w-full px-3 py-2 text-left hover:bg-slate-800/50 transition-colors flex items-center justify-between ${
                  selectedStoreId === store.id ? 'bg-amber-500/10' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 truncate">{store.name}</div>
                  {store.market && (
                    <div className="text-[10px] text-slate-500 truncate">{store.market}</div>
                  )}
                </div>
                {selectedStoreId === store.id && (
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}

            {/* No results */}
            {filteredStores.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-500">No stores found</div>
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-slate-800 bg-slate-800/30">
            <span className="text-[10px] text-slate-500">{stores.length} stores available</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaStoreSelector;
