import type { Metadata } from 'next';
import MapExplorer from '@/components/MapExplorer';

export const metadata: Metadata = {
  title: 'Hartă — Sesizări Cluj',
  description:
    'Toate sesizările publice din Cluj-Napoca pe hartă, filtrabile pe categorie, '
    + 'rezoluție, perioadă și text.',
};

export default function HartaPage() {
  return <MapExplorer />;
}
