'use client';

// app/c/[companyId]/brain/library/LibraryClient.tsx
// Client-side Library component with tabs for Reports and Documents

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Upload,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Loader2,
  File,
  FileCheck,
  Presentation,
  BookOpen,
  MessageSquare,
  ClipboardList,
} from 'lucide-react';
import { ClientBrainDocumentsPanel } from '@/components/os/ClientBrainDocumentsPanel';

// ============================================================================
// Types
// ============================================================================

export interface ReportItem {
  id: string;
  type:
    | 'gap-snapshot'
    | 'gap-plan'
    | 'gap-heavy'
    | 'website-lab'
    | 'brand-lab'
    | 'content-lab'
    | 'seo-lab'
    | 'demand-lab'
    | 'ops-lab'
    | 'creative-lab'
    | 'document';
  title: string;
  description: string;
  status: 'completed' | 'running' | 'failed' | 'pending';
  createdAt: string;
  url?: string;
  modules?: string[];
  score?: number;
}

interface LibraryClientProps {
  companyId: string;
  companyName: string;
  reports: ReportItem[];
}

// ============================================================================
// Main Component
// ============================================================================

export function LibraryClient({ companyId, companyName, reports }: LibraryClientProps) {
  const [activeTab, setActiveTab] = useState<'reports' | 'documents'>('reports');
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Library</h2>
          <p className="text-sm text-slate-400 mt-1">
            Diagnostic reports and uploaded documents
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'reports'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          Reports ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'documents'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
          }`}
        >
          Documents
        </button>
      </div>

      {/* Content */}
      {activeTab === 'reports' ? (
        <ReportsTab reports={reports} companyId={companyId} />
      ) : (
        <ClientBrainDocumentsPanel companyId={companyId} companyName={companyName} />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          companyId={companyId}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            setActiveTab('documents');
            // Trigger a refresh by switching tabs
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Reports Tab
// ============================================================================

function ReportsTab({ reports, companyId }: { reports: ReportItem[]; companyId: string }) {
  if (reports.length === 0) {
    return <EmptyReportsState companyId={companyId} />;
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}

// ============================================================================
// Report Card Component
// ============================================================================

function ReportCard({ report }: { report: ReportItem }) {
  const statusConfig = {
    completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Completed' },
    running: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Running' },
    failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
    pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'Pending' },
  };

  const status = statusConfig[report.status];
  const StatusIcon = status.icon;

  const typeLabels: Record<ReportItem['type'], string> = {
    'gap-snapshot': 'GAP IA',
    'gap-plan': 'GAP Plan',
    'gap-heavy': 'GAP Heavy',
    'website-lab': 'Website Lab',
    'brand-lab': 'Brand Lab',
    'content-lab': 'Content Lab',
    'seo-lab': 'SEO Lab',
    'demand-lab': 'Demand Lab',
    'ops-lab': 'Ops Lab',
    'creative-lab': 'Creative Lab',
    'document': 'Document',
  };

  const content = (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700 transition-all">
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-slate-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-slate-200">{report.title}</h3>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
            {typeLabels[report.type]}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400 line-clamp-1">
          {report.description}
        </p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(report.createdAt)}
          </span>
          <span className={`flex items-center gap-1 ${status.color}`}>
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>
          {report.score !== undefined && (
            <span className="flex items-center gap-1 text-amber-400">
              Score: {report.score}
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      {report.url && report.status === 'completed' && (
        <div className="flex-shrink-0">
          <span className="text-xs text-slate-500">View →</span>
        </div>
      )}
    </div>
  );

  if (report.url && report.status === 'completed') {
    return <Link href={report.url}>{content}</Link>;
  }

  return content;
}

// ============================================================================
// Empty States
// ============================================================================

function EmptyReportsState({ companyId }: { companyId: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-6">
          <FileText className="w-8 h-8 text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-200 mb-2">No Reports Yet</h2>
        <p className="text-sm text-slate-400 mb-6">
          Run diagnostics to generate reports for this company.
        </p>
        <Link
          href={`/c/${companyId}/diagnostics`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition-colors"
        >
          Run Diagnostics
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Upload Modal
// ============================================================================

interface UploadModalProps {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadModal({ companyId, onClose, onSuccess }: UploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>('other');
  const [notes, setNotes] = useState('');

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      // For now, we'll create a data URL for storage
      // In production, this should upload to cloud storage (S3, etc.)
      const reader = new FileReader();

      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      // Create the document record
      const response = await fetch('/api/client-brain/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name: selectedFile.name,
          type: docType,
          mimeType: selectedFile.type,
          sizeBytes: selectedFile.size,
          storageUrl: dataUrl, // In production, this would be a cloud storage URL
          notes: notes || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload document');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const docTypes = [
    { value: 'brief', label: 'Brief' },
    { value: 'contract', label: 'Contract' },
    { value: 'deck', label: 'Deck/Presentation' },
    { value: 'research', label: 'Research' },
    { value: 'transcript', label: 'Transcript' },
    { value: 'report', label: 'Report' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">Upload Document</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragging
                ? 'border-amber-500 bg-amber-500/10'
                : selectedFile
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <FileCheck className="w-8 h-8 text-emerald-400" />
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-200">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-sm text-slate-300 mb-1">
                  Drag and drop a file here, or
                </p>
                <label className="text-sm text-amber-400 hover:text-amber-300 cursor-pointer">
                  browse to upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx,.xls,.xlsx"
                  />
                </label>
                <p className="text-xs text-slate-500 mt-2">
                  PDF, Word, PowerPoint, Excel, Text files
                </p>
              </>
            )}
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Document Type
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {docTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any relevant notes about this document..."
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 rounded-lg transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}
