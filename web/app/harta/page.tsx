import type { Metadata } from 'next';
import { Suspense } from 'react';
import MapExplorer from '@/components/MapExplorer';

export const metadata: Metadata = {
  title: 'Hartă — Sesizări Cluj',
  description:
    'Toate sesizările publice din Cluj-Napoca pe hartă, filtrabile pe categorie, '
    + 'rezoluție, perioadă și text.',
};

export default function HartaPage() {
  // MapExplorer reads the query string so the dashboard can link in with a filter
  // already applied; useSearchParams needs a boundary on a prerendered route.
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <MapExplorer />
    </Suspense>
  );
}
