import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';

/*
  Romanian needs comma-below on ș and ț, not cedilla, and that lives in the
  latin-ext subset -- requesting only `latin` would drop the diacritics that
  appear in nearly every street and cartier name on the site. Inter ships the
  correct forms; the previous stack ended at `Arial, Helvetica, sans-serif` and
  left the shape of those two letters to whatever the visitor's OS resolved.
*/
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

/* Mono carries only digits, dates and ticket ids, so `latin` covers it. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

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
    <html lang="ro" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      {/*
        min-h-dvh + flex column lets one shell serve both shapes: the dashboard
        grows past the viewport and scrolls, while the map page's root claims the
        leftover height with flex-1 instead of measuring the header.
      */}
      <body className="flex min-h-dvh flex-col bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {/*
          Vercel Web Analytics. Cookieless and with no visitor identifier, so it
          needs no consent banner -- which matters here, since the whole point of
          the site is that it handles other people's reports carefully. The
          component injects a script pointing at /_vercel/insights/script.js, a
          path only Vercel's edge serves, so outside a deployment the request
          404s and nothing is collected.
        */}
        <Analytics />
      </body>
    </html>
  );
}
