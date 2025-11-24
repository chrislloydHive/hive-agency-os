// components/gap/FullGapReportPreview.tsx
// Human-readable preview of Full GAP markdown report

"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { FullGapLoadingState } from "./FullGapLoadingState";

type RunStatus = "idle" | "running" | "success" | "error";

interface FullGapReportPreviewProps {
  markdown: string | null;
  status?: RunStatus;
}

export function FullGapReportPreview({ markdown, status = "idle" }: FullGapReportPreviewProps) {
  // Show loading state when generating
  if (status === "running") {
    return <FullGapLoadingState />;
  }

  // Show empty state when no report
  if (!markdown) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6 text-center text-slate-400">
        No Full GAP report available yet.
      </div>
    );
  }

  return (
    <div className="prose prose-invert prose-slate max-w-none">
      <ReactMarkdown
        components={{
          // Style headings
          h1: ({ children }) => (
            <h1 className="mb-4 border-b border-slate-700 pb-2 text-3xl font-bold text-slate-100">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-8 border-b border-slate-800 pb-2 text-2xl font-semibold text-slate-200">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 text-xl font-semibold text-slate-300">
              {children}
            </h3>
          ),
          // Style paragraphs
          p: ({ children }) => (
            <p className="mb-4 leading-relaxed text-slate-300">{children}</p>
          ),
          // Style lists
          ul: ({ children }) => (
            <ul className="mb-4 space-y-2 text-slate-300">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 space-y-2 text-slate-300">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="ml-4 text-slate-300">{children}</li>
          ),
          // Style tables
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700 border border-slate-700">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
              {children}
            </tbody>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-sm font-semibold text-slate-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-slate-300">{children}</td>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-500 bg-slate-800/50 pl-4 py-2 italic text-slate-300">
              {children}
            </blockquote>
          ),
          // Style code
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-emerald-400">
                  {children}
                </code>
              );
            }
            return (
              <code className="block rounded bg-slate-800 p-3 text-sm text-slate-300">
                {children}
              </code>
            );
          },
          // Style strong/bold
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-100">{children}</strong>
          ),
          // Style emphasis/italic
          em: ({ children }) => (
            <em className="italic text-slate-300">{children}</em>
          ),
          // Style links
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-emerald-400 underline hover:text-emerald-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Style horizontal rules
          hr: () => <hr className="my-6 border-slate-700" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
