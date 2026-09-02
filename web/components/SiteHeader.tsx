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
 */
export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Sesizări Cluj
          </Link>
          {/*
            Support link.

            Drawn in markup rather than using Ko-fi's button image, which has
            "Buy me a coffee" baked into the pixels and cannot be said in
            Romanian. Doing it here also means no image request at all: the site
            makes no third-party requests today -- next/font self-hosts the faces
            and the analytics beacon comes from this origin -- and hotlinking
            Ko-fi's CDN would have sent every visitor's IP and referring URL out
            for a decorative button, on every page.

            The two colours are lifted from the button this replaces (#e3d6c6
            ground, #202020 ink) and are set for both themes rather than being
            swapped: a cream pill reads on white and on near-black alike, and it
            is the one element here that should not recede.

            The cup is a plain drawing, not Ko-fi's mark -- their logo is theirs,
            and a generic cup carries the meaning without borrowing it.

            24px tall, not the 36px Ko-fi's snippet asks for: this sits in a
            sticky bar whose contents are about 20px tall, and the taller button
            would grow the header on every page, the map included.
          */}
          <a href="https://ko-fi.com/I3S52695KJ" target="_blank" rel="noreferrer"
            className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[#e3d6c6] px-2.5 text-xs font-medium text-[#202020] transition hover:opacity-80"
            aria-label="Ia-mi o cafea — susține proiectul pe Ko-fi (se deschide într-o filă nouă)">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
              <path fill="currentColor" d="M2.5 6.5h8V10a4 4 0 0 1-8 0V6.5Z" />
              <path fill="none" stroke="currentColor" strokeWidth="1.3"
                d="M10.6 7.6h1.1a1.8 1.8 0 0 1 0 3.5h-1.1" />
              <path fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
                d="M5 4.5c.7-.8-.7-1.5 0-2.3M8 4.5c.7-.8-.7-1.5 0-2.3" />
            </svg>
            Ia-mi o cafea
          </a>
        </div>
        <nav aria-label="Navigare principală" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href}
                aria-current={active ? 'page' : undefined}
                className={active
                  ? 'font-medium text-neutral-900 underline decoration-2 underline-offset-8 dark:text-neutral-100'
                  : 'text-neutral-500 underline-offset-8 hover:text-neutral-900 hover:underline dark:hover:text-neutral-100'}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
