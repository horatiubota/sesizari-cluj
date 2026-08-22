import Link from 'next/link';
import { query } from '@/lib/db';

export const metadata = {
  title: 'Probleme recurente — Sesizări Cluj',
  description:
    'Locuri unde aceeași problemă a fost raportată de mai multe ori, ani la rând, deși sesizările au fost închise ca rezolvate favorabil.',
};

export const revalidate = 3600;

interface Cluster {
  cluster_id: number; lat: number; lon: number; n: number; years_spanned: number;
  pct_favorabil: number; n_open: number; neighborhood: string | null;
  recent_tickets: string[]; first_at: string; last_at: string;
  category: string; recurrence_meaning: string;
}

const TABS = [
  { key: 'infrastructura', label: 'Infrastructură' },
  { key: 'mixt', label: 'Mixte' },
  { key: 'comportament', label: 'Comportament' },
] as const;

export default async function Recurente({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string }>;
}) {
  const { tip } = await searchParams;
  const meaning = TABS.some((t) => t.key === tip) ? tip! : 'infrastructura';

  const clusters = await query<Cluster>(
    `select rc.cluster_id, rc.lat, rc.lon, rc.n, rc.years_spanned, rc.pct_favorabil,
            rc.n_open, rc.neighborhood, rc.recent_tickets, rc.first_at, rc.last_at,
            cat.name as category, cat.recurrence_meaning
     from public.recurrence_clusters rc
     join public.categories cat on cat.id = rc.category_id
     where cat.recurrence_meaning = $1 and rc.years_spanned >= 3
     order by rc.n desc limit 60`,
    [meaning],
  );

  const [agg] = await query<{ clusters: number; tickets: number }>(
    `select count(*)::int as clusters, coalesce(sum(rc.n),0)::int as tickets
     from public.recurrence_clusters rc
     join public.categories cat on cat.id = rc.category_id
     where cat.recurrence_meaning = $1 and rc.years_spanned >= 3`,
    [meaning],
  );

  const yr = (s: string): string => new Date(s).getFullYear().toString();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <nav className="mb-8 text-sm">
        <Link href="/" className="underline underline-offset-4">← Hartă</Link>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight">Probleme recurente</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        Locuri unde aceeași categorie de problemă a fost raportată de cel puțin cinci
        ori, pe o rază de aproximativ 11 metri, în cel puțin trei ani calendaristici
        diferiți.
      </p>

      <section className="mt-5 max-w-2xl rounded-md border border-neutral-300 p-4 text-sm leading-relaxed dark:border-neutral-700">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Cum se citesc datele</h2>
        <p className="mt-2 text-neutral-700 dark:text-neutral-300">
          Repetarea nu înseamnă același lucru pentru toate categoriile.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
          <li>
            <strong>Infrastructură</strong> — un stâlp de iluminat, o groapă sau un
            indicator reparat și raportat din nou nu a rămas reparat. Aici repetarea
            spune ceva despre reparație.
          </li>
          <li>
            <strong>Comportament</strong> — o mașină parcată din nou neregulamentar
            este un eveniment nou. Faptul că Primăria a ridicat o mașină în 2019 nu
            spune nimic despre altă mașină în 2024. Aceste cifre sunt cele mai mari,
            dar sunt cea mai slabă dovadă.
          </li>
        </ul>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Coloana <em>„favorabil”</em> arată ce procent din sesizările din acel loc au
          fost închise ca rezolvate favorabil.
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/recurente?tip=${t.key}`}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              meaning === t.key
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}>
            {t.label}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        {agg?.clusters.toLocaleString('ro-RO')} locuri, {agg?.tickets.toLocaleString('ro-RO')} sesizări.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-700">
              <th className="py-2 pr-3 font-medium">Sesizări</th>
              <th className="py-2 pr-3 font-medium">Ani</th>
              <th className="py-2 pr-3 font-medium">Favorabil</th>
              <th className="py-2 pr-3 font-medium">Categorie</th>
              <th className="py-2 pr-3 font-medium">Cartier</th>
              <th className="py-2 pr-3 font-medium">Perioadă</th>
              <th className="py-2 font-medium">Exemple</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((c) => (
              <tr key={c.cluster_id} className="border-b border-neutral-200 align-top dark:border-neutral-800">
                <td className="py-2 pr-3 font-mono tabular-nums">{c.n}</td>
                <td className="py-2 pr-3 tabular-nums">{c.years_spanned}</td>
                <td className="py-2 pr-3 tabular-nums">{c.pct_favorabil}%</td>
                <td className="py-2 pr-3">{c.category}</td>
                <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-400">{c.neighborhood ?? '—'}</td>
                <td className="py-2 pr-3 whitespace-nowrap tabular-nums text-neutral-600 dark:text-neutral-400">
                  {yr(c.first_at)}–{yr(c.last_at)}
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {c.recent_tickets.slice(0, 3).map((t) => (
                      <a key={t} href={`https://mycluj.e-primariaclujnapoca.ro/?c=${t}`}
                        target="_blank" rel="noreferrer"
                        className="font-mono text-xs underline underline-offset-2">
                        {t.replace('CAS-0', '')}
                      </a>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="mt-10 max-w-2xl border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-800">
        Sursa datelor: platforma My Cluj a Primăriei Cluj-Napoca. Gruparea se face pe
        coordonate rotunjite la 4 zecimale (~11 m) și pe categorie. Sesizările fără
        localizare aleasă de utilizator sunt excluse.
      </footer>
    </main>
  );
}
