import type { Metadata } from 'next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Sesizări Cluj',
  description:
    'Toate sesizările publice trimise Primăriei Cluj-Napoca prin platforma My Cluj, din 2017 până azi — căutabile, pe hartă și analizate.',
  openGraph: {
    title: 'Sesizări Cluj',
    description: 'Sesizările publice din Cluj-Napoca, din 2017 până azi.',
    locale: 'ro_RO',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      {/*
        min-h-dvh + flex column lets one shell serve both shapes: the dashboard
        grows past the viewport and scrolls, while the map page's root claims the
        leftover height with flex-1 instead of measuring the header.
      */}
      <body className="flex min-h-dvh flex-col bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
