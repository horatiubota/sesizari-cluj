'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Panou' },
  { href: '/harta', label: 'Hartă' },
  { href: '/recurente', label: 'Recurente' },
  { href: '/urmarite', label: 'Urmărite' },
];

/**
 * Site-wide navigation bar.
 *
 * A client component only so it can read the active route itself; passing
 * `current` down would mean every page repeating what it already is, and the
 * map page has no server component of its own to do it from.
 *
 * On a phone the four destinations become a full-width row of equal tabs, each
 * at least 44px tall, instead of a wrapped line of small text links: this is
 * the bar a thumb hits most, on every page.
 */
export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 px-4 sm:flex-nowrap sm:px-6">
        <Link href="/" className="flex h-12 items-center gap-2 text-[15px] font-semibold tracking-tight">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
            <rect x="1" y="9" width="3" height="6" rx="0.5" fill="var(--o-fav)" />
            <rect x="6.5" y="5" width="3" height="10" rx="0.5" fill="var(--o-part)" />
            <rect x="12" y="1" width="3" height="14" rx="0.5" fill="var(--ink)" />
          </svg>
          Sesizări Cluj
        </Link>

        <nav aria-label="Navigare principală"
          className="order-last -mx-4 flex w-[calc(100%+2rem)] border-t border-line sm:order-none sm:mx-0 sm:w-auto sm:border-0">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-11 flex-1 items-center justify-center px-3 text-sm sm:h-12 sm:flex-none ${
                  active ? 'font-medium text-ink' : 'text-ink-3 hover:text-ink'
                }`}>
                {l.label}
                {active && (
                  <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-ink" />
                )}
              </Link>
            );
          })}
        </nav>

        {/*
          Support link.

          Drawn in markup rather than using Ko-fi's button image, which has
          "Buy me a coffee" baked into the pixels and cannot be said in
          Romanian. Doing it here also means no image request at all: the site
          makes no third-party requests today -- next/font self-hosts the faces
          and the analytics beacon comes from this origin -- and hotlinking
          Ko-fi's CDN would have sent every visitor's IP and referring URL out
          for a decorative button, on every page.

          It sits last and quiet: as the warmest object in the bar it used to
          pull the eye ahead of the site's own name.

          The cup is a plain drawing, not Ko-fi's mark -- their logo is theirs,
          and a generic cup carries the meaning without borrowing it.
        */}
        <a href="https://ko-fi.com/I3S52695KJ" target="_blank" rel="noreferrer"
          className="ml-auto flex h-12 shrink-0 items-center gap-1.5 text-sm text-ink-3 hover:text-ink"
          aria-label="Ia-mi o cafea — susține proiectul pe Ko-fi (se deschide într-o filă nouă)">
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path fill="currentColor" d="M2.5 6.5h8V10a4 4 0 0 1-8 0V6.5Z" />
            <path fill="none" stroke="currentColor" strokeWidth="1.3"
              d="M10.6 7.6h1.1a1.8 1.8 0 0 1 0 3.5h-1.1" />
            <path fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
              d="M5 4.5c.7-.8-.7-1.5 0-2.3M8 4.5c.7-.8-.7-1.5 0-2.3" />
          </svg>
          <span>Ia-mi o cafea</span>
        </a>
      </div>
    </header>
  );
}
