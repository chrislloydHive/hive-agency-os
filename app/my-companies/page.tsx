// app/my-companies/page.tsx
// "My Companies" - User-curated dashboard for pinned companies
//
// Shows only companies the user has explicitly pinned.
// Pinned IDs are stored in localStorage; data is fetched client-side.

import { MyCompaniesClient } from './MyCompaniesClient';

export const metadata = {
  title: 'My Companies | Hive OS',
  description: 'Your pinned companies for quick access',
};

export default function MyCompaniesPage() {
  return <MyCompaniesClient />;
}
