// components/docs/DataTable.tsx
// Simple table component for milestones, stakeholders, etc.

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
}

export function DataTable<T extends object>({
  columns,
  data,
}: DataTableProps<T>) {
  return (
    <div className="no-break overflow-hidden border border-[#D9D9D9] rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-[#D9D9D9]">
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left font-semibold text-gray-700"
                style={{ width: col.width }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="px-4 py-2.5 text-gray-600 border-t border-gray-100">
                  {typeof col.accessor === 'function'
                    ? col.accessor(row)
                    : (row[col.accessor] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Simple List Table (for milestones with timing)
// ============================================================================

interface MilestoneItem {
  name: string;
  timing: string;
  description?: string;
}

interface MilestoneTableProps {
  milestones: MilestoneItem[];
}

export function MilestoneTable({ milestones }: MilestoneTableProps) {
  return (
    <div className="no-break overflow-hidden border border-[#D9D9D9] rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-[#D9D9D9]">
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-1/4">
              Timing
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-1/3">
              Milestone
            </th>
            <th className="px-4 py-2.5 text-left font-semibold text-gray-700">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((milestone, index) => (
            <tr
              key={index}
              className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
            >
              <td className="px-4 py-2.5 text-gray-500 border-t border-gray-100 font-medium">
                {milestone.timing}
              </td>
              <td className="px-4 py-2.5 text-gray-800 border-t border-gray-100 font-medium">
                {milestone.name}
              </td>
              <td className="px-4 py-2.5 text-gray-600 border-t border-gray-100">
                {milestone.description || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
