'use client';

import Link from 'next/link';
import Image from 'next/image';
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

            Self-hosted rather than the <img src="https://storage.ko-fi.com/…"> Ko-fi
            hands out. The site issues no third-party requests today -- next/font
            self-hosts the faces and the analytics beacon comes from this origin -- so an
            external image would be the first, and would send every visitor's IP and
            referring URL to a CDN for a decorative button, on every page. Copying the
            file keeps the request list first-party, which is the same reason layout.tsx
            picks cookieless analytics.

            Rendered at 24px, not the 36px Ko-fi suggests: this sits in a sticky bar
            whose contents are ~20px tall, and the taller button would grow the header on
            every page, including the map, where vertical space is the scarce thing.
          */}
          <a href="https://ko-fi.com/I3S52695KJ" target="_blank" rel="noreferrer"
            className="shrink-0 rounded transition hover:opacity-75"
            aria-label="Susține proiectul pe Ko-fi (se deschide într-o filă nouă)">
            <Image src="/kofi.png" alt="Susține proiectul pe Ko-fi"
              width={95} height={24} className="h-6 w-auto" unoptimized />
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
