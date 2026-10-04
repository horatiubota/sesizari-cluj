import type { Metadata } from 'next';
import { Roboto_Condensed, Roboto_Serif, Source_Sans_3 } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';

/*
  Three faces, chosen as the closest free relatives of a financial weekly's
  type: a serif narrowed on its width axis for headlines and quoted replies, a
  plain sans for reading, a condensed sans for figures and chart labels.

  Romanian needs comma-below on ș and ț, not cedilla, and that lives in the
  latin-ext subset -- requesting only `latin` would drop the diacritics that
  appear in nearly every street and cartier name on the site. All three ship
  the correct forms. next/font self-hosts them, so the site still makes no
  third-party request for fonts.
*/
const serif = Roboto_Serif({
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth', 'opsz'],
  variable: '--font-serif-face',
  display: 'swap',
});

const sans = Source_Sans_3({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans-face',
  display: 'swap',
});

const condensed = Roboto_Condensed({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-cond-face',
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
    <html lang="ro" className={`${serif.variable} ${sans.variable} ${condensed.variable}`}>
      {/*
        min-h-dvh + flex column lets one shell serve both shapes: the dashboard
        grows past the viewport and scrolls, while the map page's root claims the
        leftover height with flex-1 instead of measuring the header.

        The catch: a page's `<main className="mx-auto max-w-…">` is a flex item
        here, and auto side margins make it shrink-to-fit its content instead of
        stretching. A wide table then widens main itself rather than scrolling in
        its own overflow-x-auto box, and on a phone the whole page pans sideways.
        Every centred main therefore also carries `w-full`.
      */}
      <body className="flex min-h-dvh flex-col bg-bg text-ink antialiased">
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
        {/*
          Real-user Core Web Vitals, from the same edge-only path: the script
          lives at /_vercel/speed-insights/script.js, so it too is inert outside
          a deployment. It reports timings, not visitors -- no cookie, no id.
        */}
        <SpeedInsights />
      </body>
    </html>
  );
}
