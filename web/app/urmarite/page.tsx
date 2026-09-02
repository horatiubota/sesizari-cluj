import type { Metadata } from 'next';
import { Suspense } from 'react';
import WatchList from '@/components/WatchList';

export const metadata: Metadata = {
  title: 'Sesizări urmărite — Sesizări Cluj',
  description:
    'Sesizările pe care le urmărești, cu ce s-a schimbat de când le-ai adăugat: '
    + 'închideri, răspunsuri oficiale modificate și raportări noi în același loc.',
  // The list lives in the visitor's browser, so there is nothing here for a
  // crawler to index and the page is different for every reader.
  robots: { index: false, follow: true },
};

export default function UrmaritePage() {
  // WatchList reads `?t=` to import a shared list; useSearchParams needs a
  // Suspense boundary on a prerendered route, exactly as /harta does.
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <WatchList />
    </Suspense>
  );
}
