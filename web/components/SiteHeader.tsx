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
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Sesizări Cluj
        </Link>
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
