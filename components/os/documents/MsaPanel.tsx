'use client';
// components/os/documents/MsaPanel.tsx
// MSA Panel Component - Stub

type Props = {
  companyId: string;
  companyName?: string;
  msaDriveUrl?: string | null;
  hasDriveFolder?: boolean;
};

export function MsaPanel({ companyId, companyName }: Props) {
  return (
    <div className="border rounded p-4 bg-gray-50">
      <h3 className="font-semibold">MSA Documents</h3>
      <p className="text-gray-500 text-sm mt-2">
        MSA panel for {companyName || companyId} - stub implementation
      </p>
    </div>
  );
}
