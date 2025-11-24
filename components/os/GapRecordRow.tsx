'use client';

import ArchiveButton from './ArchiveButton';

interface GapRecordRowProps {
  recordId: string;
  table: string;
  children: React.ReactNode;
}

/**
 * Wrapper component for Gap record table rows
 * Adds archive functionality while keeping server-rendered content
 */
export default function GapRecordRow({ recordId, table, children }: GapRecordRowProps) {
  return (
    <tr className="border-b border-slate-800/50 last:border-0 group hover:bg-slate-800/30">
      {children}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <ArchiveButton recordId={recordId} table={table} action="archive" />
        </div>
      </td>
    </tr>
  );
}
