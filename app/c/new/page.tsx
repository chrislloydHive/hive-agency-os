// app/c/new/page.tsx
// Manual Prospect Wizard - Multi-step form to create a new prospect

import { Metadata } from 'next';
import { ProspectWizard } from '@/app/companies/new/ProspectWizard';
import { TEAM_MEMBERS } from '@/lib/pipeline/routingConfig';

export const metadata: Metadata = {
  title: 'Add Prospect | Hive OS',
  description: 'Create a new prospect in Hive OS',
};

export default async function NewProspectPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-100">Add New Prospect</h1>
          <p className="text-slate-400 mt-1">
            Create a new prospect and optionally run initial diagnostics
          </p>
        </div>

        <ProspectWizard teamMembers={TEAM_MEMBERS} />
      </div>
    </div>
  );
}
