'use client';

// app/c/[companyId]/programs/ProgramsIndexClient.tsx
// Programs Index Page - Landing page showing all program types
//
// Shows cards for each program type with status, last updated, and primary action
// Features AI recommendation card for "Next Program to Build"

import { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  FileText,
  Sparkles,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { ProgramRecord, ProgramType } from '@/lib/types/program';

// ============================================================================
// Types
// ============================================================================

interface ProgramSummary {
  type: ProgramType;
  label: string;
  description: string;
  icon: React.ReactNode;
  program: ProgramRecord | null;
  isEnabled: boolean;
  labReady: boolean;
  labLabel: string;
}

interface ProgramsIndexClientProps {
  companyId: string;
  companyName: string;
  programs: ProgramRecord[];
  hasWebsiteLab: boolean;
  hasContentLab: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(timestamp: string | null): string | null {
  if (!timestamp) return null;

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 30) {
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  }
  if (diffDays > 0) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

function getProgramStatus(program: ProgramRecord | null): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (!program) {
    return {
      label: 'Not started',
      color: 'text-slate-400',
      bgColor: 'bg-slate-700/50',
    };
  }

  switch (program.status) {
    case 'active':
      return {
        label: 'Active',
        color: 'text-green-400',
        bgColor: 'bg-green-900/30',
      };
    case 'draft':
      return {
        label: 'Draft',
        color: 'text-amber-400',
        bgColor: 'bg-amber-900/30',
      };
    case 'archived':
      return {
        label: 'Archived',
        color: 'text-slate-500',
        bgColor: 'bg-slate-800/50',
      };
    default:
      return {
        label: 'Unknown',
        color: 'text-slate-400',
        bgColor: 'bg-slate-700/50',
      };
  }
}

function getPrimaryAction(
  program: ProgramRecord | null,
  labReady: boolean
): {
  label: string;
  icon: React.ReactNode;
  variant: 'primary' | 'secondary' | 'disabled';
} {
  if (!program) {
    if (!labReady) {
      return {
        label: 'Complete Lab First',
        icon: <AlertCircle className="w-4 h-4" />,
        variant: 'disabled',
      };
    }
    return {
      label: 'Generate',
      icon: <Sparkles className="w-4 h-4" />,
      variant: 'primary',
    };
  }

  if (program.status === 'draft') {
    return {
      label: 'Continue',
      icon: <ArrowRight className="w-4 h-4" />,
      variant: 'primary',
    };
  }

  return {
    label: 'View',
    icon: <Eye className="w-4 h-4" />,
    variant: 'secondary',
  };
}

// ============================================================================
// Component
// ============================================================================

export function ProgramsIndexClient({
  companyId,
  companyName,
  programs,
  hasWebsiteLab,
  hasContentLab,
}: ProgramsIndexClientProps) {
  const [showOtherPrograms, setShowOtherPrograms] = useState(false);

  // Build program summaries for each type
  const websiteProgram = programs.find(p => p.type === 'website' && p.status !== 'archived') || null;
  const contentProgram = programs.find(p => p.type === 'content' && p.status !== 'archived') || null;

  const programSummaries: ProgramSummary[] = [
    {
      type: 'website',
      label: 'Website Program',
      description: 'Prioritized website improvements based on diagnostics and strategy',
      icon: <Globe className="w-6 h-6" />,
      program: websiteProgram,
      isEnabled: true,
      labReady: hasWebsiteLab,
      labLabel: 'Website Lab',
    },
    {
      type: 'content',
      label: 'Content Program',
      description: 'Content strategy and priorities based on content analysis',
      icon: <FileText className="w-6 h-6" />,
      program: contentProgram,
      isEnabled: true,
      labReady: hasContentLab,
      labLabel: 'Content Lab',
    },
  ];

  // Determine recommended next program
  // Priority: Website Program first (if not active), then Content Program
  const recommendedProgram = !websiteProgram || websiteProgram.status === 'draft'
    ? programSummaries[0] // Website
    : !contentProgram || contentProgram.status === 'draft'
    ? programSummaries[1] // Content
    : null; // All programs are active

  // Primary program is Website, others are secondary
  const primaryProgram = programSummaries[0];
  const secondaryPrograms = programSummaries.slice(1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <a href={`/c/${companyId}`} className="hover:text-slate-300">
              {companyName}
            </a>
            <span>/</span>
            <span className="text-slate-200">Programs</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Programs</h1>
          <p className="text-sm text-slate-400 mt-1">
            AI-generated programs that translate strategy into prioritized work
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6 max-w-4xl">
        {/* AI Recommendation Card */}
        {recommendedProgram && (
          <div className="bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-blue-500/10 border border-amber-500/30 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <Sparkles className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-medium text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Next Program to Build
                    </span>
                  </div>
                  <p className="text-lg font-medium text-white">{recommendedProgram.label}</p>
                  <p className="text-sm text-slate-400">
                    {recommendedProgram.program?.status === 'draft'
                      ? 'Continue where you left off'
                      : recommendedProgram.labReady
                      ? 'Ready to generate from your strategy'
                      : `Complete ${recommendedProgram.labLabel} first`}
                  </p>
                </div>
              </div>
              <Link
                href={`/c/${companyId}/programs/${recommendedProgram.type}`}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors shadow-lg ${
                  recommendedProgram.labReady
                    ? 'text-white bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                    : 'text-slate-300 bg-slate-700 hover:bg-slate-600 shadow-slate-700/20'
                }`}
              >
                {recommendedProgram.program?.status === 'draft' ? 'Continue' : recommendedProgram.labReady ? 'Build Program' : 'View Details'}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Primary Program Card (Website) */}
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wide">Primary Program</h2>
          <ProgramCard
            summary={primaryProgram}
            companyId={companyId}
          />
        </div>

        {/* Secondary Programs (Collapsed by default) */}
        <div>
          <button
            onClick={() => setShowOtherPrograms(!showOtherPrograms)}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors mb-3 uppercase tracking-wide"
          >
            {showOtherPrograms ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Other Programs ({secondaryPrograms.length})
          </button>

          {showOtherPrograms && (
            <div className="grid grid-cols-1 gap-4">
              {secondaryPrograms.map((summary) => (
                <ProgramCard
                  key={summary.type}
                  summary={summary}
                  companyId={companyId}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Program Card
// ============================================================================

function ProgramCard({
  summary,
  companyId,
  compact = false,
}: {
  summary: ProgramSummary;
  companyId: string;
  compact?: boolean;
}) {
  const status = getProgramStatus(summary.program);
  const action = getPrimaryAction(summary.program, summary.labReady);
  const timeAgo = summary.program ? formatTimeAgo(summary.program.updatedAt) : null;

  // Compact variant for secondary programs
  if (compact) {
    const compactContent = (
      <div
        className={`
          relative bg-slate-900/30 border rounded-lg p-4
          transition-all duration-200
          ${summary.isEnabled
            ? 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/50 cursor-pointer'
            : 'border-slate-800 opacity-60 cursor-not-allowed'
          }
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
              {summary.icon}
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{summary.label}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs ${status.color}`}>{status.label}</span>
                {timeAgo && (
                  <span className="text-xs text-slate-500">· {timeAgo}</span>
                )}
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500" />
        </div>
      </div>
    );

    if (!summary.isEnabled) {
      return compactContent;
    }

    return (
      <Link href={`/c/${companyId}/programs/${summary.type}`}>
        {compactContent}
      </Link>
    );
  }

  // Full card variant for primary program
  const cardContent = (
    <div
      className={`
        relative bg-slate-900/50 border rounded-xl p-6
        transition-all duration-200
        ${summary.isEnabled
          ? 'border-slate-700 hover:border-slate-600 hover:bg-slate-900/70 cursor-pointer'
          : 'border-slate-800 opacity-60 cursor-not-allowed'
        }
      `}
    >
      {/* Icon and Title */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800 rounded-lg text-blue-400">
            {summary.icon}
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">{summary.label}</h2>
            <p className="text-sm text-slate-400">{summary.description}</p>
          </div>
        </div>
      </div>

      {/* Status and Metadata */}
      <div className="space-y-3 mb-6">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
            {summary.program?.status === 'active' && <CheckCircle className="w-3 h-3 inline mr-1" />}
            {status.label}
          </span>
          {!summary.labReady && !summary.program && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-900/30 text-amber-400">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {summary.labLabel} required
            </span>
          )}
        </div>

        {/* Last Updated */}
        {timeAgo && (
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Clock className="w-4 h-4" />
            <span>Updated {timeAgo}</span>
          </div>
        )}

        {/* Program Title Preview */}
        {summary.program?.plan?.title && (
          <p className="text-sm text-slate-300 line-clamp-2">
            {summary.program.plan.title}
          </p>
        )}
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between">
        <button
          disabled={action.variant === 'disabled'}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            transition-colors
            ${action.variant === 'primary'
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : action.variant === 'secondary'
              ? 'bg-slate-700 hover:bg-slate-600 text-white'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          {action.icon}
          {action.label}
        </button>

        {summary.program?.status === 'active' && (
          <button
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            onClick={(e) => e.preventDefault()}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        )}
      </div>
    </div>
  );

  if (!summary.isEnabled) {
    return cardContent;
  }

  return (
    <Link href={`/c/${companyId}/programs/${summary.type}`}>
      {cardContent}
    </Link>
  );
}
