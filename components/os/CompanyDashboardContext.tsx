'use client';

// components/os/CompanyDashboardContext.tsx
// Context for company-scoped dashboard views
// When a company is selected, all widgets filter to that company's data

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Company, CompanyId } from '@/lib/os/types';

// ============================================================================
// Types
// ============================================================================

export interface CompanyContextState {
  // Selected company (null = workspace-wide view)
  selectedCompany: Company | null;
  companyId: CompanyId | null;

  // Actions
  selectCompany: (company: Company) => void;
  clearCompany: () => void;
  isCompanySelected: boolean;

  // UI state
  isCompanyDrawerOpen: boolean;
  openCompanyDrawer: () => void;
  closeCompanyDrawer: () => void;
}

const CompanyDashboardContext = createContext<CompanyContextState | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface CompanyDashboardProviderProps {
  children: React.ReactNode;
  initialCompany?: Company | null;
}

export function CompanyDashboardProvider({
  children,
  initialCompany = null,
}: CompanyDashboardProviderProps) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(initialCompany);
  const [isCompanyDrawerOpen, setIsCompanyDrawerOpen] = useState(false);

  const selectCompany = useCallback((company: Company) => {
    setSelectedCompany(company);
  }, []);

  const clearCompany = useCallback(() => {
    setSelectedCompany(null);
  }, []);

  const openCompanyDrawer = useCallback(() => {
    setIsCompanyDrawerOpen(true);
  }, []);

  const closeCompanyDrawer = useCallback(() => {
    setIsCompanyDrawerOpen(false);
  }, []);

  const value = useMemo<CompanyContextState>(
    () => ({
      selectedCompany,
      companyId: selectedCompany?.id ?? null,
      selectCompany,
      clearCompany,
      isCompanySelected: selectedCompany !== null,
      isCompanyDrawerOpen,
      openCompanyDrawer,
      closeCompanyDrawer,
    }),
    [
      selectedCompany,
      selectCompany,
      clearCompany,
      isCompanyDrawerOpen,
      openCompanyDrawer,
      closeCompanyDrawer,
    ]
  );

  return (
    <CompanyDashboardContext.Provider value={value}>
      {children}
    </CompanyDashboardContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCompanyContext(): CompanyContextState {
  const context = useContext(CompanyDashboardContext);
  if (!context) {
    throw new Error('useCompanyContext must be used within a CompanyDashboardProvider');
  }
  return context;
}

// ============================================================================
// Optional Hook (safe to use outside provider)
// ============================================================================

export function useOptionalCompanyContext(): CompanyContextState | null {
  return useContext(CompanyDashboardContext) ?? null;
}

// ============================================================================
// Utility Hook - Get company-aware query params
// ============================================================================

export function useCompanyQueryParams(): { companyId?: string } {
  const context = useOptionalCompanyContext();
  if (!context?.companyId) {
    return {};
  }
  return { companyId: context.companyId };
}

// ============================================================================
// Company Selector Component
// ============================================================================

interface CompanySelectorProps {
  companies: Company[];
  className?: string;
}

export function CompanySelector({ companies, className = '' }: CompanySelectorProps) {
  const { selectedCompany, selectCompany, clearCompany } = useCompanyContext();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={selectedCompany?.id || ''}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) {
            clearCompany();
          } else {
            const company = companies.find((c) => c.id === id);
            if (company) {
              selectCompany(company);
            }
          }
        }}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
      >
        <option value="">All Companies (Workspace View)</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>

      {selectedCompany && (
        <button
          onClick={clearCompany}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Company Badge Component
// ============================================================================

interface CompanyBadgeProps {
  className?: string;
}

export function CompanyBadge({ className = '' }: CompanyBadgeProps) {
  const { selectedCompany, clearCompany } = useCompanyContext();

  if (!selectedCompany) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full ${className}`}
    >
      <span className="text-sm font-medium text-amber-400">
        {selectedCompany.name}
      </span>
      <button
        onClick={clearCompany}
        className="text-amber-400/60 hover:text-amber-400 transition-colors"
        aria-label="Clear company filter"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

// ============================================================================
// HOC - With Company Context
// ============================================================================

export function withCompanyContext<P extends object>(
  WrappedComponent: React.ComponentType<P & { companyContext: CompanyContextState }>
) {
  return function WithCompanyContextComponent(props: P) {
    const companyContext = useCompanyContext();
    return <WrappedComponent {...props} companyContext={companyContext} />;
  };
}

export default CompanyDashboardContext;
