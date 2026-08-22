import Link from 'next/link';
import Nav from '@/components/Nav';
import { Bar, DailyBars, Delta, Sparkline, StackedBars } from '@/components/charts';
import { CATEGORIES, CATEGORY_BY_ID, OUTCOME_LABEL } from '@/lib/categories';
import {
  getBacklogByYear, getByCategory, getByNeighborhood, getDaily, getDailyByCategory,
  getLatest, getMonthlyOutcome, getOverview, getWeekTotals,
} from '@/lib/dashboard';

/**
 * Main dashboard.
 *
 * Rebuilt on a schedule rather than per request: the underlying data changes
 * once a day when the sync job runs, so every visitor can share one render.
 */
export const revalidate = 1800;

const OUTCOME_BANDS = [
  { key: 'favorabil',  color: '#3f9142', label: OUTCOME_LABEL.Favorabil },
  { key: 'partial',    color: '#d9a441', label: OUTCOME_LABEL.Partial },
  { key: 'transferat', color: '#2f8f9d', label: OUTCOME_LABEL['Transferata operatorului'] },
  { key: 'respins',    color: '#d94f4f', label: 'Respinsă / nefavorabil' },
  { key: 'deschise',   color: '#9a9a9a', label: 'Încă deschisă' },
];

const nf = new Intl.NumberFormat('ro-RO');
const DATE_LONG = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
const DATE_SHORT = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
const fmtLong = (iso: string) => DATE_LONG.format(new Date(`${iso}T12:00:00`));
const fmtShort = (iso: string) => DATE_SHORT.format(new Date(`${iso}T12:00:00`));

function Section({ title, note, children }: {
  title: string; note?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {note && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-neutral-500">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Ranked table shared by the category and neighbourhood breakdowns. */
function RankedTable({ rows, colorFor, trendFor }: {
  rows: { key: string; label: string; cur: number; prev: number; ly: number }[];
  colorFor: (key: string) => string;
  trendFor?: (key: string) => number[];
}) {
  const max = Math.max(...rows.map((r) => r.cur), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="text-left text-xs text-neutral-500">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-1.5 font-medium">&nbsp;</th>
            <th className="py-1.5 pr-3 text-right font-medium">Săpt.</th>
            <th className="py-1.5 pr-3 text-right font-medium">vs săpt. trecută</th>
            <th className="py-1.5 pr-3 text-right font-medium">vs anul trecut</th>
            {trendFor && <th className="py-1.5 font-medium">60 de zile</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
              <td className="py-1.5 pr-4 align-middle">
                <span className="block truncate">{r.label}</span>
                <Bar value={r.cur} max={max} color={colorFor(r.key)} />
              </td>
              <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{r.cur}</td>
              <td className="py-1.5 pr-3 text-right text-xs">
                <span className="text-neutral-400">{r.prev} </span><Delta cur={r.cur} base={r.prev} />
              </td>
              <td className="py-1.5 pr-3 text-right text-xs">
                <span className="text-neutral-400">{r.ly} </span><Delta cur={r.cur} base={r.ly} />
              </td>
              {trendFor && (
                <td className="py-1.5">
                  <Sparkline values={trendFor(r.key)} color={colorFor(r.key)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Dashboard() {
  const [overview, week, byCat, byNb, daily, dailyCat, latest, backlog, monthly] =
    await Promise.all([
      getOverview(), getWeekTotals(), getByCategory(), getByNeighborhood(),
      getDaily(182), getDailyByCategory(60), getLatest(6), getBacklogByYear(),
      getMonthlyOutcome(),
    ]);

  // Pivot the per-category daily counts into dense series for the sparklines.
  const days = [...new Set(dailyCat.map((r) => r.day))].sort();
  const trend = new Map<string, number[]>();
  for (const c of CATEGORIES) trend.set(String(c.id), days.map(() => 0));
  for (const r of dailyCat) {
    const series = trend.get(String(r.category_id));
    if (series) series[days.indexOf(r.day)] = r.n;
  }

  const dailyMean = Math.round(daily.reduce((s, d) => s + d.total, 0) / (daily.length || 1));
  const busiest = daily.reduce((a, b) => (b.total > a.total ? b : a), daily[0]);
  const pctFav = ((overview.favorabil / overview.total) * 100).toFixed(1);
  const pctOpen = ((overview.open / overview.total) * 100).toFixed(1);
  // The newest day in the data may itself be partial: the sync runs mid-day, and
  // reports keep arriving after it. The day before it is the last certain one.
  const lastComplete = daily.filter((d) => d.day !== overview.last_day).at(-1);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Sesizări Cluj</h1>
          <Nav current="/" />
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {nf.format(overview.total)} sesizări publice trimise Primăriei Cluj-Napoca prin
          platforma My Cluj, din {fmtLong(overview.first_day)} până
          în {fmtLong(overview.last_day)}. Preluare zilnică de pe platforma oficială;
          ultima sesizare din oglindă este de la {overview.last_seen}.{' '}
          <Link href="/harta" className="underline underline-offset-4">
            Vezi sesizările pe hartă →
          </Link>
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      <Section
        title={`Săptămâna curentă — săptămâna ISO ${week.iso_week}`}
        note={
          <>
            Săptămâna curentă este incompletă, așa că toate cele trei intervale sunt
            trunchiate la aceleași {week.days} zile ({fmtShort(week.week_start)} – {fmtShort(week.today)}),
            pentru a nu produce o scădere artificială. Reperul este ultima zi acoperită de
            date, nu ziua calendaristică: preluarea rulează o dată pe zi, iar o zi goală
            adăugată la săptămâna curentă ar arăta ca o scădere reală.
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
            <div className="text-xs text-neutral-500">Sesizări depuse, {week.days} zile</div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">{nf.format(week.cur)}</div>
            <div className="mt-1 text-xs text-neutral-500">
              începând cu luni, {fmtShort(week.week_start)}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="text-xs text-neutral-500">Față de săptămâna trecută</div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
              <Delta cur={week.cur} base={week.prev} />
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {nf.format(week.prev)} în aceleași {week.days} zile, de la {fmtShort(week.prev_start)}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="text-xs text-neutral-500">Față de aceeași săptămână, anul trecut</div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">
              <Delta cur={week.cur} base={week.ly} />
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {nf.format(week.ly)} în aceleași {week.days} zile, de la {fmtShort(week.ly_start)}
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Sesizări pe zi"
        note={`Ultimele ${daily.length} de zile. Linia este media mobilă pe 7 zile, care
               netezește tiparul săptămânal — sâmbăta și duminica sunt constant sub medie.`}
      >
        <DailyBars data={daily} />
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
          <span>Medie: <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{dailyMean}</span>/zi</span>
          {busiest && (
            <span>
              Vârf: <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{busiest.total}</span>
              {' '}pe {fmtLong(busiest.day)}
            </span>
          )}
          {lastComplete && (
            <span>
              Ultima zi completă ({fmtShort(lastComplete.day)}):{' '}
              <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{lastComplete.total}</span>
            </span>
          )}
          <span>
            Ultima zi preluată ({fmtShort(overview.last_day)}), posibil parțială:{' '}
            <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{overview.last_day_count}</span>
          </span>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Pe categorii"
        note="Săptămâna curentă pe categorii, cu aceleași două comparații. Linia arată
              volumul zilnic din ultimele 60 de zile, scalată independent pe fiecare rând."
      >
        <RankedTable
          rows={byCat.map((r) => ({
            ...r, label: CATEGORY_BY_ID.get(Number(r.key))?.short ?? r.label,
          }))}
          colorFor={(k) => CATEGORY_BY_ID.get(Number(k))?.color ?? '#888'}
          trendFor={(k) => trend.get(k) ?? []}
        />
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Pe cartiere"
        note="Cartierul este atribuit geometric, din coordonatele sesizării, folosind
              limitele de cartier din OpenStreetMap. Sesizările fără coordonate utile
              apar ca „nelocalizat”."
      >
        <RankedTable rows={byNb} colorFor={() => '#6b7280'} />
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Cum se închid sesizările"
        note={
          <>
            Compoziția rezultatelor pe luna în care a fost depusă sesizarea, pe toată
            perioada. Ultimele luni conțin încă sesizări nesoluționate, deci banda gri
            de la dreapta nu indică o schimbare de practică, ci sesizări în lucru.
          </>
        }
      >
        <StackedBars
          data={monthly.map((m) => ({
            label: m.month,
            values: {
              favorabil: m.favorabil, partial: m.partial, transferat: m.transferat,
              respins: m.respins, deschise: m.deschise,
            },
          }))}
          bands={OUTCOME_BANDS}
        />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-neutral-500">
          <span>{monthly[0]?.month}</span>
          <span>{monthly.at(-1)?.month}</span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {OUTCOME_BANDS.map((b) => (
            <li key={b.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
              <span className="text-neutral-600 dark:text-neutral-400">{b.label}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            { k: 'Favorabil', v: `${pctFav}%`, s: `${nf.format(overview.favorabil)} sesizări` },
            { k: 'Parțial', v: nf.format(overview.partial), s: 'închise parțial' },
            { k: 'Transferate operatorului', v: nf.format(overview.transferat), s: 'CTP, Compania de Apă ș.a.' },
            { k: 'Respinse / nefavorabil', v: nf.format(overview.respins), s: `${((overview.respins / overview.total) * 100).toFixed(1)}% din total` },
          ].map((c) => (
            <div key={c.k} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <dt className="text-xs text-neutral-500">{c.k}</dt>
              <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{c.v}</dd>
              <dd className="text-xs text-neutral-500">{c.s}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Sesizări încă deschise, după anul depunerii"
        note={`${nf.format(overview.open)} sesizări (${pctOpen}% din total) figurează și acum
               ca „Nouă” sau „În lucru”. Cele din anii vechi nu sunt un volum mare, dar sunt
               înregistrări care nu au fost niciodată închise.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="py-1.5 font-medium">An</th>
                <th className="py-1.5 pr-3 text-right font-medium">Depuse</th>
                <th className="py-1.5 pr-3 text-right font-medium">Încă deschise</th>
                <th className="py-1.5 text-right font-medium">Pondere</th>
              </tr>
            </thead>
            <tbody>
              {backlog.map((r) => (
                <tr key={r.year} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                  <td className="py-1.5 font-mono tabular-nums">{r.year}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-neutral-500">{nf.format(r.total)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{nf.format(r.still_open)}</td>
                  <td className="py-1.5 text-right font-mono text-xs tabular-nums text-neutral-500">
                    {((r.still_open / r.total) * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="Ultimele sesizări" note="Cele mai recente înregistrări preluate de pe platformă.">
        <ul className="space-y-3">
          {latest.map((t) => {
            const cat = CATEGORY_BY_ID.get(t.category_id);
            return (
              <li key={t.ticket_number}
                className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: cat?.color ?? '#888' }} />
                    <span className="text-neutral-700 dark:text-neutral-300">{cat?.short ?? t.category_id}</span>
                  </span>
                  <span className="font-mono text-neutral-500">{t.created_at}</span>
                  {t.neighborhood && <span className="text-neutral-500">{t.neighborhood}</span>}
                  <span className="text-neutral-500">
                    {OUTCOME_LABEL[t.status_label] ?? t.status_label}
                  </span>
                  <a href={`https://mycluj.e-primariaclujnapoca.ro/?c=${t.ticket_number}`}
                    target="_blank" rel="noreferrer"
                    className="ml-auto font-mono text-neutral-400 underline underline-offset-2">
                    {t.ticket_number}
                  </a>
                </div>
                {t.description && (
                  <p className="mt-1.5 text-sm leading-relaxed">{t.description.slice(0, 260)}
                    {t.description.length > 260 ? '…' : ''}</p>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="Note de metodă">
        <ul className="max-w-3xl space-y-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">
              Timpul până la soluționare nu poate fi calculat retroactiv.
            </strong>{' '}
            Platforma publică doar starea curentă a unei sesizări, nu și data la care a fost
            închisă. Din 22 august 2026 înregistrăm tranzițiile pe măsură ce le observăm, deci
            durata până la răspuns devine măsurabilă de acum înainte — dar nu pentru cele
            {' '}{nf.format(overview.total - overview.open)} de sesizări deja închise la prima preluare.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Zilele nu sunt calendaristice UTC.</strong>{' '}
            Marcajele de timp de pe platformă sunt ora locală fără fus, deci toate agregările
            folosesc ziua calendaristică Europe/Bucharest.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Rezultatul aparține sesizării, nu lunii în care a fost dat.</strong>{' '}
            Graficul de compoziție grupează sesizările după luna depunerii, nu după luna
            soluționării, pentru că a doua nu este publicată.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">O parte din sesizări nu au coordonate utile.</strong>{' '}
            Formularul oficial pornește cu un pin implicit în Piața Unirii, iar sesizările
            lăsate acolo sunt excluse din analizele spațiale de pe hartă. Aici sunt numărate
            normal, dar apar ca „nelocalizat” la defalcarea pe cartiere dacă nu au putut fi
            atribuite.
          </li>
          <li>
            Textele sesizărilor sunt trecute printr-un filtru care elimină adrese de e-mail,
            numere de telefon, CNP-uri, IBAN-uri și semnături. Restul textului este cel public.
          </li>
        </ul>
      </Section>
    </main>
  );
}
