'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
  Download,
  Sparkles,
  ExternalLink,
  FileCheck,
  Presentation,
  BookOpen,
  MessageSquare,
  ClipboardList,
  File,
} from 'lucide-react';
import type { ClientDocument, DocumentType } from '@/lib/types/clientBrain';
import { DOCUMENT_TYPE_CONFIG } from '@/lib/types/clientBrain';

interface ClientBrainDocumentsPanelProps {
  companyId: string;
  companyName: string;
}

// Icon map for document types
const DOC_TYPE_ICONS: Record<DocumentType, React.ComponentType<{ className?: string }>> = {
  brief: FileText,
  contract: FileCheck,
  deck: Presentation,
  research: BookOpen,
  transcript: MessageSquare,
  report: ClipboardList,
  other: File,
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getDocTypeColorClass(type: DocumentType | null | undefined): string {
  if (!type) return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  const colorMap: Record<DocumentType, string> = {
    brief: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    contract: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    deck: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    research: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    transcript: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
    report: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    other: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colorMap[type];
}

export function ClientBrainDocumentsPanel({ companyId, companyName }: ClientBrainDocumentsPanelProps) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ companyId });
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }

      const response = await fetch(`/api/client-brain/documents?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch documents');
      }

      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [companyId, typeFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleExtractInsights = async (documentId: string) => {
    try {
      setExtractingId(documentId);
      setError(null);

      const response = await fetch(`/api/client-brain/documents/${documentId}/extract-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract insights');
      }

      if (data.alreadyExtracted) {
        setError(`Already extracted ${data.insights?.length || 0} insights from this document`);
      } else {
        setError(null);
        // Show success message
        alert(`Successfully extracted ${data.insights?.length || 0} insights!`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract insights');
    } finally {
      setExtractingId(null);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      setDeletingId(documentId);
      const response = await fetch(`/api/client-brain/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete document');
      }

      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  // Group documents by type for filter chips
  const typeGroups = documents.reduce((acc, doc) => {
    const type = doc.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<DocumentType, ClientDocument[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Client Documents</h2>
            <p className="text-sm text-slate-400">
              Uploaded files for {companyName}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            // For now, show a placeholder - real implementation would open a file upload modal
            alert('Document upload coming soon! For now, documents are created via the API.');
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-200">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-400 hover:text-red-300 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Type Filter Chips */}
      {Object.keys(typeGroups).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              typeFilter === 'all'
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
            }`}
          >
            All ({documents.length})
          </button>
          {Object.entries(typeGroups).map(([type, typeDocs]) => {
            const config = DOCUMENT_TYPE_CONFIG[type as DocumentType];
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(type as DocumentType)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  typeFilter === type
                    ? getDocTypeColorClass(type as DocumentType)
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
                }`}
              >
                {config?.label || type} ({typeDocs.length})
              </button>
            );
          })}
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-xl">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No documents yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Upload briefs, contracts, decks, and other client files
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                  Document
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                  Size
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                  Uploaded
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const DocIcon = doc.type ? DOC_TYPE_ICONS[doc.type] : File;
                const isExtracting = extractingId === doc.id;
                const isDeleting = deletingId === doc.id;

                return (
                  <tr
                    key={doc.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg border ${getDocTypeColorClass(doc.type)}`}
                        >
                          <DocIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-200">{doc.name}</div>
                          {doc.textExtracted && (
                            <span className="text-xs text-emerald-500">Text extracted</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {doc.type ? (
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded border ${getDocTypeColorClass(
                            doc.type
                          )}`}
                        >
                          {DOCUMENT_TYPE_CONFIG[doc.type]?.label || doc.type}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatFileSize(doc.sizeBytes)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatDate(doc.uploadedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Extract Insights */}
                        <button
                          onClick={() => handleExtractInsights(doc.id)}
                          disabled={isExtracting || !doc.textExtracted}
                          title={
                            doc.textExtracted
                              ? 'Extract insights with AI'
                              : 'Text must be extracted first'
                          }
                          className="p-1.5 text-amber-400 hover:text-amber-300 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                          {isExtracting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </button>

                        {/* Download */}
                        <a
                          href={doc.storageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={isDeleting}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes section for documents with notes */}
      {documents.some((d) => d.notes) && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Document Notes</h3>
          {documents
            .filter((d) => d.notes)
            .map((doc) => (
              <div
                key={doc.id}
                className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg"
              >
                <div className="text-xs font-medium text-slate-400 mb-1">{doc.name}</div>
                <div className="text-sm text-slate-300">{doc.notes}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default ClientBrainDocumentsPanel;
