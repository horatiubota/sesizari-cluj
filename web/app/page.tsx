import { Suspense } from 'react';
import { Bar, Delta, Sparkline, StackedColumns, StepCurve } from '@/components/charts';
import DailyVolume from '@/components/DailyVolume';
import { OutcomeKey } from '@/components/OutcomeBar';
import OutcomeTable, { type TableRow } from '@/components/OutcomeTable';
import Picker, { PickerView } from '@/components/Picker';
import { CATEGORIES, CATEGORY_BY_ID, OUTCOME_LABEL } from '@/lib/categories';
import {
  getByCategory, getByNeighborhood, getDaily, getDailyBreakdown, getLatest,
  getMonthlyOutcome, getOutcomeMatrix, getOverview, getResolutionCurve,
  getRollingTotals, getWeeklySummary, OUTCOME_WEEKS, type Counts, type LatestTicket,
} from '@/lib/dashboard';
import { BANDS, nf, pct } from '@/lib/outcomes';

/**
 * Main dashboard.
 *
 * Rebuilt on a schedule rather than per request: the underlying data changes
 * once a day when the sync job runs, so every visitor can share one render.
 * The parts that read the URL -- the picker and the table sort order -- are
 * client islands inside Suspense, so the page itself stays static.
 */
export const revalidate = 1800;

const DAILY_DAYS = 182;

/**
 * Rows to lift out of the resolution curve into a table. Only those the window
 * actually reaches are shown, so the table stays short as the window lengthens
 * instead of growing a row a day.
 */
const CHECKPOINTS = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90];

/** Past this, the freshness line says the mirror has stopped updating. */
const STALE_HOURS = 36;

const DATE_LONG = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
const DATE_SHORT = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
const MONTH_YEAR = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' });
const fmtLong = (iso: string) => DATE_LONG.format(new Date(`${iso}T12:00:00`));
const fmtShort = (iso: string) => DATE_SHORT.format(new Date(`${iso}T12:00:00`));
/** "2026-10-03 12:43" (Bucharest wall clock, as stored) -> "3 oct. 2026, 12:43". */
const fmtStamp = (s: string, year = true) =>
  `${DATE_SHORT.format(new Date(`${s.slice(0, 10)}T12:00:00`))}${year ? ` ${s.slice(0, 4)}` : ''}, ${s.slice(11)}`;
const PCT1 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pctNum = (v: number) => `${PCT1.format(v)}%`;

const counts = (o: { total: number; favorabil: number; partial: number; transferat: number; respins: number; deschise: number }): Counts =>
  [o.total, o.favorabil, o.partial, o.transferat, o.respins, o.deschise];

function Section({ id, title, note, children }: {
  id?: string; title: string; note?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-line pt-8 pb-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {note && <div className="mt-1.5 max-w-[68ch] text-sm leading-relaxed text-ink-2">{note}</div>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * A headline figure. Set large and bare -- no card around it -- with what it
 * counts and over which window directly beneath, so it cannot be quoted
 * without its denominator.
 */
function Figure({ value, label, detail }: { value: string; label: string; detail: React.ReactNode }) {
  return (
    <div className="min-w-0 border-t border-line pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5 sm:first:border-l-0 sm:first:pl-0">
      <div className="text-[2.5rem] leading-none font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-2 text-sm font-medium">{label}</div>
      <div className="mt-0.5 text-xs leading-relaxed text-ink-3">{detail}</div>
    </div>
  );
}

/** A ticket's current status, drawn with its outcome band so lists and strips agree. */
function Status({ label }: { label: string }) {
  const band =
    label === 'Favorabil' ? BANDS[0]
      : label === 'Partial' ? BANDS[1]
        : label === 'Transferata operatorului' ? BANDS[2]
          : label === 'Respinsa' || label === 'Nefavorabil' ? BANDS[3]
            : BANDS[4];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-ink-2">
      <span className={`${band.cls} inline-block h-2 w-2 rounded-full`} aria-hidden="true" />
      {OUTCOME_LABEL[label] ?? label}
    </span>
  );
}

function LatestList({ latest, compact = false }: { latest: LatestTicket[]; compact?: boolean }) {
  if (!latest.length) return <p className="text-sm text-ink-2">Nicio sesizare preluată încă.</p>;
  return (
    <ul className="divide-y divide-line">
      {latest.map((t) => {
        const cat = CATEGORY_BY_ID.get(t.category_id);
        return (
          <li key={t.ticket_number} className="py-3 first:pt-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-ink-3">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full" aria-hidden="true"
                  style={{ backgroundColor: cat?.color ?? 'var(--ink-3)' }} />
                {cat?.short ?? t.category_id}
              </span>
              {t.neighborhood && <span>{t.neighborhood}</span>}
              <span className="tabular-nums">{fmtStamp(t.created_at, false)}</span>
              <Status label={t.status_label} />
            </div>
            {t.description && (
              <p className={`mt-1.5 text-sm leading-relaxed ${compact ? 'line-clamp-3' : ''}`}>
                {t.description.slice(0, 260)}{t.description.length > 260 ? '…' : ''}
              </p>
            )}
            <a href={`https://mycluj.e-primariaclujnapoca.ro/?c=${t.ticket_number}`}
              target="_blank" rel="noreferrer"
              className="mt-1 inline-block py-1 text-xs text-ink-2 tabular-nums underline decoration-line-strong underline-offset-4 hover:text-ink">
              {t.ticket_number} pe My Cluj
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The monthly composition chart as numbers, for screen readers. By year rather
 * than by month: 116 rows read aloud is not an alternative anyone would use,
 * and a year per row still carries the 2021 break the chart is annotated for.
 */
function YearlyTable({ monthly }: { monthly: { month: string; total: number; favorabil: number; partial: number; transferat: number; respins: number; deschise: number }[] }) {
  const years = new Map<string, Counts>();
  for (const m of monthly) {
    const y = years.get(m.month.slice(0, 4)) ?? [0, 0, 0, 0, 0, 0];
    const c = counts(m);
    for (let i = 0; i < 6; i++) y[i] += c[i]!;
    years.set(m.month.slice(0, 4), y as Counts);
  }
  return (
    <table className="sr-only">
      <caption>Cum s-au închis sesizările, pe anul depunerii</caption>
      <thead>
        <tr><th scope="col">An</th><th scope="col">Sesizări</th>{BANDS.map((b) => <th key={b.key} scope="col">{b.label}</th>)}</tr>
      </thead>
      <tbody>
        {[...years].map(([year, c]) => (
          <tr key={year}>
            <th scope="row">{year}</th><td>{nf.format(c[0])}</td>
            {BANDS.map((b) => <td key={b.key}>{pct(c[b.idx], c[0])}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Dashboard() {
  const [overview, totals, byCat, byNb, daily, breakdown, latest, monthly, weekly, resolution, matrix] =
    await Promise.all([
      getOverview(), getRollingTotals(), getByCategory(), getByNeighborhood(),
      getDaily(DAILY_DAYS), getDailyBreakdown(DAILY_DAYS), getLatest(5),
      getMonthlyOutcome(), getWeeklySummary(), getResolutionCurve(), getOutcomeMatrix(),
    ]);

  const to = totals.d7.to;
  const city = matrix.cells['*|*']?.o ?? ([0, 0, 0, 0, 0, 0] as Counts);
  const closedCity = city[0] - city[5];

  // Freshness, from the newest report the mirror holds. Reports arrive around
  // the clock, so a gap this long means the sync stopped, not that Cluj went quiet.
  const stale = overview.hours_since_last > STALE_HOURS;

  const day7 = resolution?.points.find((p) => p.day === 7);
  const lastDay = resolution?.points.at(-1)?.day ?? 0;
  const checkpoints = resolution
    ? resolution.points.filter((p) => p.day === lastDay || CHECKPOINTS.includes(p.day))
    : [];

  // Top categories by daily volume over the chart window, as weekly sums: daily
  // counts per category are too noisy to read as a line at this size.
  const dayIndex = new Map(daily.map((d, i) => [d.day, i]));
  const perCat = new Map<number, number[]>(CATEGORIES.map((c) => [c.id, daily.map(() => 0)]));
  for (const r of breakdown.byCategory) {
    const i = dayIndex.get(r.day);
    if (i !== undefined) perCat.get(r.category_id)![i] = r.n;
  }
  const weekly26 = (series: number[]) => {
    const out: number[] = [];
    for (let end = series.length; end - 7 >= 0; end -= 7) out.unshift(series.slice(end - 7, end).reduce((s, v) => s + v, 0));
    return out;
  };
  const top = [...perCat.entries()]
    .map(([id, s]) => ({ id, total: s.reduce((a, b) => a + b, 0), weeks: weekly26(s) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const dailyTotal = daily.reduce((s, d) => s + d.total, 0);

  // Where "Parțial" drops out of the monthly record, located from the data so
  // the note can say exactly what changed and when -- and nothing about why.
  const partialShare = monthly.map((m) => (m.total ? m.partial / m.total : 0));
  const lastHigh = partialShare.findLastIndex((s) => s >= 0.02);
  let partialNote: { month: string; before: string; after: string; at: number } | null = null;
  if (lastHigh > 0 && lastHigh < monthly.length - 1) {
    const sum = (rows: typeof monthly, k: 'partial' | 'total') => rows.reduce((s, m) => s + m[k], 0);
    const pre = monthly.slice(0, lastHigh + 1);
    const post = monthly.slice(lastHigh + 1);
    const before = sum(pre, 'partial') / sum(pre, 'total');
    const after = sum(post, 'partial') / sum(post, 'total');
    if (before >= 0.03 && after < 0.01) {
      partialNote = {
        month: MONTH_YEAR.format(new Date(`${monthly[lastHigh + 1]!.month}-15T12:00:00`)),
        before: pct(sum(pre, 'partial'), sum(pre, 'total')),
        after: pct(sum(post, 'partial'), sum(post, 'total')),
        at: (lastHigh + 1) / monthly.length,
      };
    }
  }

  const win = `from=${totals.d7.from}&to=${to}`;
  const catRows: TableRow[] = byCat.map((r) => {
    const c = CATEGORY_BY_ID.get(Number(r.key));
    return {
      key: r.key, label: c?.short ?? r.label, color: c?.color, href: `/harta?cat=${r.key}&${win}`,
      cur: r.cur, prev: r.prev, ly: r.ly, o: matrix.cells[`${r.key}|*`]?.o ?? [0, 0, 0, 0, 0, 0],
    };
  });
  const nbRows: TableRow[] = byNb.map((r) => ({
    key: r.key, label: r.key === '(nelocalizat)' ? 'Fără locație' : r.label,
    href: r.key === '(nelocalizat)' ? `/harta?${win}` : `/harta?cartier=${encodeURIComponent(r.key)}&${win}`,
    cur: r.cur, prev: r.prev, ly: r.ly, o: matrix.cells[`*|${r.key}`]?.o ?? [0, 0, 0, 0, 0, 0],
  }));

  const years = monthly
    .map((m, i) => ({ i, year: m.month.slice(0, 4), jan: m.month.endsWith('-01') }))
    .filter((m) => m.jan);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <div className="lg:grid lg:grid-cols-3 lg:gap-12">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sesizările din Cluj-Napoca</h1>
          <p className="mt-2 text-sm text-ink-2">
            {nf.format(overview.total)} sesizări publice trimise Primăriei prin My Cluj,
            din {fmtLong(overview.first_day)} până azi.
          </p>
          <p className={`mt-3 inline-flex flex-wrap items-center gap-x-2 rounded-md px-2.5 py-1.5 text-xs ${
            stale ? 'bg-warn-bg text-warn' : 'bg-sunken text-ink-2'}`} role={stale ? 'status' : undefined}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${stale ? 'bg-warn' : 'bg-o-fav'}`} aria-hidden="true" />
            {stale
              ? <>Datele nu s-au mai actualizat din {fmtStamp(overview.last_seen)}. Cifrele de mai jos pot fi învechite.</>
              : <>Actualizat zilnic. Ultima sesizare preluată: <span className="tabular-nums">{fmtStamp(overview.last_seen)}</span></>}
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-0">
            <Figure
              value={nf.format(totals.d7.cur)}
              label="sesizări în ultimele 7 zile"
              detail={<>{fmtShort(totals.d7.from)} – {fmtShort(to)} · <Delta cur={totals.d7.cur} base={totals.d7.ly} /> față de aceleași zile de anul trecut</>}
            />
            {day7 ? (
              <Figure
                value={pctNum(day7.pct)}
                label="închise în cel mult 7 zile"
                detail={<>estimat din {nf.format(resolution!.cohort)} sesizări urmărite din {fmtShort(resolution!.obs_from)}</>}
              />
            ) : (
              <Figure value="—" label="închise în cel mult 7 zile" detail="încă nu sunt destule observații" />
            )}
            <Figure
              value={closedCity ? pct(city[1], closedCity) : '—'}
              label="dintre cele închise, favorabil"
              detail={<>sesizările din ultimele {OUTCOME_WEEKS} săptămâni deja închise ({nf.format(closedCity)})</>}
            />
          </div>

          <section aria-labelledby="picker-title" className="mt-10 rounded-lg border border-line bg-surface p-4 sm:p-6">
            <h2 id="picker-title" className="text-lg font-semibold tracking-tight">Ce se întâmplă cu sesizările ca a mea?</h2>
            <p className="mt-1 mb-5 text-sm text-ink-2">
              Alege o categorie și un cartier: vezi cum s-au închis sesizările din ultimele {OUTCOME_WEEKS} săptămâni.
            </p>
            <Suspense fallback={<PickerView matrix={matrix} to={to} cat="*" cartier="*" />}>
              <Picker matrix={matrix} to={to} />
            </Suspense>
          </section>
        </div>

        <aside className="hidden lg:block" aria-labelledby="latest-title-lg">
          <h2 id="latest-title-lg" className="text-sm font-semibold tracking-tight">Ultimele sesizări</h2>
          <p className="mt-0.5 mb-4 text-xs text-ink-3">Cele mai recente preluate de pe platformă.</p>
          <LatestList latest={latest} compact />
        </aside>
      </div>

      <div className="mt-12 space-y-4">
        <Section
          title="Pe categorii"
          note={<>Sesizări în ultimele 7 zile și cum s-au închis cele din ultimele {OUTCOME_WEEKS} săptămâni.
            Procentele includ sesizările încă deschise. Apasă pe o categorie ca s-o vezi pe hartă.
            Transport (CTP) și Apă/canal (CAS) sunt trimise integral operatorilor, deci apar ca transferate.</>}
        >
          <Suspense fallback={null}>
            <OutcomeTable rows={catRows} param="ord_cat" nameHeader="Categorie" weeks={OUTCOME_WEEKS}
              csvName={`sesizari-cluj-categorii-${to}.csv`} />
          </Suspense>
        </Section>

        <Section
          title="Pe cartiere"
          note={<>Cartierul e atribuit din coordonate, după limitele din OpenStreetMap; sesizările fără
            coordonate utile apar ca „fără locație” și nu pot fi filtrate pe hartă.</>}
        >
          <Suspense fallback={null}>
            <OutcomeTable rows={nbRows} param="ord_cartier" nameHeader="Cartier" weeks={OUTCOME_WEEKS}
              csvName={`sesizari-cluj-cartiere-${to}.csv`} />
          </Suspense>
        </Section>

        {resolution && (
          <Section
            id="inchidere"
            title="Cât de repede se închid"
            note={
              <>
                Se poate măsura doar pentru cele {nf.format(resolution.cohort)} de sesizări
                depuse după {fmtLong(resolution.obs_from)}, ziua în care am început să urmărim
                tranzițiile; {nf.format(resolution.measured)} dintre ele s-au închis până acum.
                Curba arată ce procent era închis după N zile, socotind fiecare sesizare atât
                timp cât am urmărit-o efectiv. Nu este media celor deja închise: aceea ar ieși
                mult prea optimistă, pentru că sesizările lente nu au apucat încă să se închidă.{' '}
                {resolution.median_day !== null
                  ? `Jumătate ajung să fie închise în cel mult ${resolution.median_day} zile.`
                  : `Curba nu a atins încă 50%, deci mediana este dincolo de cele ${lastDay} zile
                     observate și nu poate fi încă numită.`}
              </>
            }
          >
            <div className="grid gap-8 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <div className="grid grid-cols-[2.25rem_1fr]">
                  <div className="relative" aria-hidden="true">
                    {[100, 75, 50, 25, 0].map((v) => (
                      <span key={v} className="absolute right-2 -translate-y-1/2 text-xs text-ink-3 tabular-nums"
                        style={{ top: `${100 - v}%` }}>{v}%</span>
                    ))}
                  </div>
                  <StepCurve points={resolution.points} />
                </div>
                {/* Each day owns an equal slice and its step lands on the slice's right
                    edge, so right-aligning the labels puts them under their own step.
                    A month of two-digit labels needs ~350px, wider than a small phone,
                    so below sm every slice stays (keeping the alignment) but only day 1
                    and the week marks print; min-w-0 stops any label widening the page. */}
                <div className="mt-1.5 ml-9 flex text-xs text-ink-3" aria-hidden="true">
                  {resolution.points.map((p) => (
                    <span key={p.day} className="min-w-0 flex-1 text-right tabular-nums">
                      <span className={p.day === 1 || p.day % 7 === 0 ? undefined : 'max-sm:hidden'}>{p.day}</span>
                    </span>
                  ))}
                </div>
                <div className="mt-1 ml-9 text-xs text-ink-3">zile de la depunere</div>
              </div>

              <div className="lg:col-span-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-3">
                      <th scope="col" className="py-2 font-medium">Închise în</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">estimat închise</th>
                      <th scope="col" className="w-2/5 py-2"><span className="sr-only">grafic</span></th>
                      <th scope="col" className="py-2 pl-3 text-right font-medium">încă urmărite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkpoints.map((p) => (
                      <tr key={p.day} className="border-b border-line last:border-0">
                        <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">
                          {p.day} {p.day === 1 ? 'zi' : 'zile'}
                        </th>
                        <td className="py-2 pr-3 text-right font-semibold tabular-nums">{pctNum(p.pct)}</td>
                        <td className="py-2"><Bar value={p.pct} max={100} /></td>
                        <td className="py-2 pl-3 text-right text-ink-3 tabular-nums">{nf.format(p.at_risk)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* The risk set is not the denominator of the estimate -- the estimate is
                    a running product over every earlier day -- so it is labelled as what
                    it is: how much evidence still stands behind that row. */}
                <p className="mt-3 text-xs leading-relaxed text-ink-3">
                  Ultima coloană arată câte sesizări mai erau deschise și încă urmărite la
                  începutul acelei zile, nu numărul din care s-a calculat procentul. Cu cât
                  scade, cu atât rândul se sprijină pe mai puține observații; zilele rămase
                  fără destule sesizări nici nu sunt desenate.
                </p>
              </div>
            </div>
          </Section>
        )}

        <Section
          title="Sesizări pe zi"
          note={<>Ultimele {daily.length} de zile, pe ziua din Cluj (Europe/Bucharest). Apasă sau
            folosește săgețile pe grafic ca să vezi o anumită zi.</>}
        >
          <DailyVolume days={daily.map((d) => ({ day: d.day, total: d.total }))} partialDay={overview.last_day} />

          <h3 className="mt-10 text-sm font-semibold">Cele mai frecvente categorii în această perioadă</h3>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {top.map((t) => {
              const c = CATEGORY_BY_ID.get(t.id);
              return (
                <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[14rem_1fr_7rem]">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" aria-hidden="true"
                      style={{ backgroundColor: c?.color }} />
                    <span className="truncate">{c?.name ?? t.id}</span>
                  </span>
                  <Sparkline values={t.weeks} color={c?.color ?? 'var(--ink-3)'} className="col-span-2 row-start-2 h-7 w-full sm:col-span-1 sm:row-start-auto" />
                  <span className="text-right text-sm tabular-nums">
                    {pct(t.total, dailyTotal)}<span className="text-ink-3"> din total</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-3">Sesizări pe săptămână, ultimele 26 de săptămâni. Toate categoriile sunt în tabelul de mai sus.</p>
        </Section>

        <Section
          id="lunar"
          title="Cum s-au închis, lună de lună, din 2017"
          note={
            <>
              Compoziția rezultatelor pe luna în care a fost depusă sesizarea, pe toată
              perioada. Ultimele luni conțin încă sesizări nesoluționate, deci banda deschisă
              de la dreapta nu indică o schimbare de practică, ci sesizări în lucru.
            </>
          }
        >
          <OutcomeKey />
          {/* The top padding is a margin for the annotation label, so it never
              sits on the bars it is pointing at; the rule runs through it as a leader. */}
          <div className={`relative mt-4 ${partialNote ? 'pt-7' : ''}`}>
            <StackedColumns
              data={monthly.map((m) => ({ label: m.month, o: counts(m) }))}
              label={`Compoziția rezultatelor pe ${monthly.length} de luni, ${monthly[0]?.month} – ${monthly.at(-1)?.month}`}
            />
            {partialNote && (
              <span aria-hidden="true" className="absolute inset-y-0 w-px bg-ink"
                style={{ left: `${partialNote.at * 100}%` }}>
                <span className="absolute top-0 left-1.5 text-xs leading-5 whitespace-nowrap text-ink">
                  „Parțial” dispare
                </span>
              </span>
            )}
          </div>
          <YearlyTable monthly={monthly} />
          <div className="relative mt-1.5 h-4 text-xs text-ink-3 tabular-nums" aria-hidden="true">
            {years.map(({ i, year }) => (
              <span key={year}
                className={`absolute -translate-x-1/2 ${Number(year) % 2 ? 'max-sm:hidden' : ''}`}
                style={{ left: `${((i + 0.5) / monthly.length) * 100}%` }}>{year}</span>
            ))}
          </div>
          {partialNote && (
            <p className="mt-4 max-w-[68ch] text-sm leading-relaxed">
              Din {partialNote.month}, „Parțial” apare la {partialNote.after} din sesizări,
              față de {partialNote.before} înainte (linia verticală). Datele nu spun de ce;
              compară perioadele de o parte și de alta a liniei cu prudență.
            </p>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {[
              { k: 'Favorabil', v: pct(overview.favorabil, overview.total), n: overview.favorabil },
              { k: 'Parțial', v: pct(overview.partial, overview.total), n: overview.partial },
              { k: 'Transferată operatorului', v: pct(overview.transferat, overview.total), n: overview.transferat },
              { k: 'Respinsă / nefavorabil', v: pct(overview.respins, overview.total), n: overview.respins },
            ].map((c) => (
              <div key={c.k}>
                <dt className="text-xs text-ink-3">{c.k}, din 2017</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums">{c.v}</dd>
                <dd className="text-xs text-ink-3 tabular-nums">{nf.format(c.n)} sesizări</dd>
              </div>
            ))}
          </dl>
        </Section>

        <section className="border-t border-line pt-8 pb-4 lg:hidden" aria-labelledby="latest-title">
          <h2 id="latest-title" className="text-lg font-semibold tracking-tight">Ultimele sesizări</h2>
          <p className="mt-1.5 mb-5 text-sm text-ink-2">Cele mai recente înregistrări preluate de pe platformă.</p>
          <LatestList latest={latest} />
        </section>

        {weekly && (
          <section className="border-t border-line pt-8 pb-4">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <span>
                  <span className="block text-lg font-semibold tracking-tight">Săptămâna pe scurt</span>
                  <span className="mt-1 block text-sm text-ink-2">
                    Rezumat generat automat de un model de limbaj, {fmtShort(weekly.period_start)} – {fmtShort(weekly.period_end)}
                  </span>
                </span>
                <span className="mt-1 shrink-0 rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-ink-2 group-open:hidden">Arată</span>
                <span className="mt-1 hidden shrink-0 rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-ink-2 group-open:inline">Ascunde</span>
              </summary>
              <div className="mt-5 max-w-[68ch]">
                <p className="text-xs leading-relaxed text-ink-3">
                  Text generat automat de un model de limbaj ({weekly.model}) pe baza celor{' '}
                  {nf.format(weekly.n_tickets)} sesizări depuse
                  între {fmtLong(weekly.period_start)} și {fmtLong(weekly.period_end)}.
                  Generat la {weekly.generated_at}. Nu este text redactat de o persoană și
                  nu a fost verificat manual; restul cifrelor de pe această pagină vin direct
                  din date.
                </p>
                {weekly.summary.split(/\n\s*\n/).filter(Boolean).map((para, i) => (
                  <p key={i} className="mt-3 text-sm leading-relaxed">{para}</p>
                ))}
              </div>
            </details>
          </section>
        )}

        <Section title="Note de metodă">
          <ul className="max-w-[68ch] space-y-3 text-sm leading-relaxed text-ink-2">
            <li>
              <strong className="font-medium text-ink">
                Timpul până la închidere nu poate fi calculat retroactiv.
              </strong>{' '}
              Platforma publică doar starea curentă, nu și data închiderii.{' '}
              {resolution ? `Din ${fmtLong(resolution.obs_from)}` : 'De la prima preluare'}{' '}
              înregistrăm tranzițiile pe măsură ce le observăm; cele{' '}
              {nf.format(overview.total - overview.open)} de sesizări deja închise atunci rămân
              în afara curbei, pentru că data lor de închidere nu există nicăieri public.
            </li>
            <li>
              <strong className="font-medium text-ink">Sub o zi nu putem distinge.</strong>{' '}
              Preluarea rulează zilnic, deci o sesizare deschisă și închisă între două rulări
              apare direct închisă. Pentru ele folosim prima observare ca limită superioară:
              curba le numără mai încet decât au fost în realitate, niciodată mai repede.
            </li>
            <li>
              <strong className="font-medium text-ink">Zilele nu sunt calendaristice UTC.</strong>{' '}
              Marcajele platformei sunt ora locală fără fus, deci toate agregările folosesc ziua
              Europe/Bucharest.
            </li>
            <li>
              <strong className="font-medium text-ink">Rezultatul aparține sesizării, nu lunii în care a fost dat.</strong>{' '}
              Compoziția grupează după luna depunerii, nu a soluționării: a doua nu e publicată.
            </li>
            <li>
              <strong className="font-medium text-ink">O parte din sesizări nu au coordonate utile.</strong>{' '}
              Formularul pornește cu un pin implicit în Piața Unirii; sesizările lăsate acolo
              sunt excluse din analizele spațiale, dar numărate normal — apar ca „nelocalizat”.
            </li>
            <li>
              <strong className="font-medium text-ink">Comparațiile cu anul trecut</strong> sunt decalate cu 364 de
              zile, ca să cadă pe aceleași zile ale săptămânii. Sub 10 sesizări în perioada de
              comparație afișăm cele două numere, nu un procent.
            </li>
            <li>
              Textele trec printr-un filtru care elimină adrese de e-mail, numere de telefon,
              CNP-uri, IBAN-uri și semnături. Restul este textul public.
            </li>
          </ul>
        </Section>
      </div>
    </main>
  );
}
