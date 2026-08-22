import Link from 'next/link';

const LINKS = [
  { href: '/', label: 'Panou' },
  { href: '/harta', label: 'Hartă' },
  { href: '/recurente', label: 'Probleme recurente' },
];

/** Shared site navigation. `current` is the href of the active page. */
export default function Nav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {LINKS.map((l) =>
        l.href === current ? (
          <span key={l.href} className="font-medium text-neutral-900 dark:text-neutral-100">
            {l.label}
          </span>
        ) : (
          <Link key={l.href} href={l.href}
            className="text-neutral-500 underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-100">
            {l.label}
          </Link>
        ),
      )}
    </nav>
  );
}
