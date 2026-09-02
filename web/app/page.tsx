import Link from 'next/link';
import DailyCategoryChart, { type Day } from '@/components/DailyCategoryChart';
import { Bar, Delta, OutcomeBar, Sparkline, StackedBars, StepCurve } from '@/components/charts';
import { CATEGORIES, CATEGORY_BY_ID, OUTCOME_LABEL } from '@/lib/categories';
import {
  getByCategory, getByNeighborhood, getDaily, getDailyBreakdown,
  getLatest, getMonthlyOutcome, getOutcomeByCategory, getOutcomeByNeighborhood,
  getOverview, getResolutionCurve, getRollingTotals, getWeeklySummary,
  type OutcomeShare, type WindowCounts,
} from '@/lib/dashboard';

/**
 * Main dashboard.
 *
 * Rebuilt on a schedule rather than per request: the underlying data changes
 * once a day when the sync job runs, so every visitor can share one render.
 */
export const revalidate = 1800;

const DAILY_DAYS = 182;

/** Shared by the outcome bands and the resolution curve: both mean "closed". */
const CLOSED_COLOR = '#3f9142';

/**
 * Window for the outcome columns. Matches the trend sparkline beside them, and
 * is long enough that most reports in it have been answered -- at 7 days about
 * 69% are still open, at 60 days about 23%. The remainder stays visible as the
 * grey band of the composition strip rather than being divided out.
 */
const OUTCOME_DAYS = 60;

/**
 * Rows to lift out of the resolution curve into a table. Only those the window
 * actually reaches are shown, so the table stays short as the window lengthens
 * instead of growing a row a day.
 */
const CHECKPOINTS = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90];

const OUTCOME_BANDS = [
  { key: 'favorabil',  color: CLOSED_COLOR, label: OUTCOME_LABEL.Favorabil },
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

/**
 * Zero is nothing to report, not 0.0% -- an outcome a category never produces.
 * A share that is real but rounds to 0.0 gets a threshold instead, so the two
 * cases stay distinguishable: several categories transfer a handful of reports
 * out of tens of thousands, and printing that as 0.0% next to a true — reads as
 * a rounding bug rather than as the difference it is.
 */
const pctOf = (n: number, total: number): string => {
  if (n === 0 || total === 0) return '—';
  const pct = (n / total) * 100;
  return pct < 0.05 ? '<0.1%' : `${pct.toFixed(1)}%`;
};

/** The five OUTCOME_BANDS keys, so the strip and the legend above it agree. */
const bandsOf = (o: OutcomeShare): Record<string, number> => ({
  favorabil: o.favorabil, partial: o.partial, transferat: o.transferat,
  respins: o.respins, deschise: o.deschise,
});

const outcomeTitle = (o: OutcomeShare): string =>
  `${nf.format(o.total)} de sesizări în ultimele ${OUTCOME_DAYS} de zile — `
  + OUTCOME_BANDS.map((b) => `${b.label}: ${pctOf(bandsOf(o)[b.key] ?? 0, o.total)}`).join(' · ');

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

/** Headline count with both comparisons for the same rolling window. */
function CountCard({ label, value, sub, window: w }: {
  label: string; value: number; sub: string; window?: WindowCounts;
}) {
  return (
    <div className="rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-3xl font-semibold tabular-nums">{nf.format(value)}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>
      {w && (
        <dl className="mt-3 space-y-1 border-t border-neutral-200 pt-2 text-xs dark:border-neutral-800">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-neutral-500">față de perioada anterioară</dt>
            <dd><Delta cur={w.cur} base={w.prev} /></dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-neutral-500">față de anul trecut</dt>
            <dd><Delta cur={w.cur} base={w.ly} /></dd>
          </div>
        </dl>
      )}
    </div>
  );
}

/**
 * Ranked breakdown. Every row links into the map with the same filter and the
 * same date window applied, so a number on this page and the map behind it
 * always describe the identical selection.
 *
 * The header is two tiers because the columns answer questions over different
 * spans: volume is the rolling 7 days, outcome composition the trailing 60.
 * Putting them in one flat header would invite reading the composition as "of
 * the last 7 days", which it is not and cannot be -- barely half of a week's
 * reports have been answered yet.
 *
 * The composition is a strip and a hover breakdown rather than a strip plus
 * columns of percentages: two of the five bands had been promoted into numbers,
 * which read as the summary while the other three -- including the grey unclosed
 * remainder that decides how to read the rest -- stayed in the graphic.
 */
function RankedTable({ rows, colorFor, hrefFor, trendFor, outcomeFor }: {
  rows: { key: string; label: string; cur: number; prev: number; ly: number }[];
  colorFor: (key: string) => string;
  hrefFor: (key: string) => string;
  trendFor?: (key: string) => number[];
  outcomeFor?: (key: string) => OutcomeShare | undefined;
}) {
  const max = Math.max(...rows.map((r) => r.cur), 1);
  const group = 'py-1 text-[10px] font-medium tracking-wide text-neutral-400 uppercase';
  // The two header tiers only pay for themselves if the boundary is visible.
  const divider = 'border-l border-neutral-200 dark:border-neutral-800';
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${outcomeFor ? 'min-w-[44rem]' : 'min-w-[38rem]'} text-sm`}>
        <thead className="text-left text-xs text-neutral-500">
          {outcomeFor && (
            <tr>
              <th />
              <th colSpan={3} className={`${group} pr-3 text-center`}>ultimele 7 zile</th>
              <th className={`${group} ${divider} pl-3 text-center`}>
                rezultate, ultimele {OUTCOME_DAYS} de zile
              </th>
              {trendFor && <th />}
            </tr>
          )}
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="py-1.5 font-medium">&nbsp;</th>
            <th className="py-1.5 pr-3 text-right font-medium">{outcomeFor ? 'număr' : '7 zile'}</th>
            <th className="py-1.5 pr-3 text-right font-medium">vs 7 anterioare</th>
            <th className="py-1.5 pr-3 text-right font-medium">vs anul trecut</th>
            {outcomeFor && (
              <th className={`${divider} w-44 py-1.5 pl-3 font-medium`}>compoziție</th>
            )}
            {trendFor && <th className="py-1.5 pl-3 font-medium">60 de zile</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const o = outcomeFor?.(r.key);
            return (
              <tr key={r.key}
                className="group border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/60">
                <td className="py-1.5 pr-4 align-middle">
                  <Link href={hrefFor(r.key)}
                    title={`Vezi „${r.label}” pe hartă, aceleași 7 zile`}
                    className="flex items-center gap-1.5">
                    <span className="truncate">{r.label}</span>
                    <span aria-hidden="true"
                      className="text-neutral-400 opacity-0 transition group-hover:opacity-100">
                      →
                    </span>
                    <span className="sr-only">— vezi pe hartă</span>
                  </Link>
                  <Bar value={r.cur} max={max} color={colorFor(r.key)} />
                </td>
                <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{r.cur}</td>
                <td className="py-1.5 pr-3 text-right text-xs">
                  <span className="text-neutral-400">{r.prev} </span><Delta cur={r.cur} base={r.prev} />
                </td>
                <td className="py-1.5 pr-3 text-right text-xs">
                  <span className="text-neutral-400">{r.ly} </span><Delta cur={r.cur} base={r.ly} />
                </td>
                {outcomeFor && (
                  <td className={`${divider} py-1.5 pl-3 align-middle`}>
                    {o && <OutcomeBar values={bandsOf(o)} bands={OUTCOME_BANDS} title={outcomeTitle(o)} />}
                  </td>
                )}
                {trendFor && (
                  <td className="py-1.5 pl-3">
                    <Sparkline values={trendFor(r.key)} color={colorFor(r.key)} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function Dashboard() {
  const [overview, totals, byCat, byNb, daily, breakdown, latest, monthly, weekly, resolution,
         outCat, outNb] =
    await Promise.all([
      getOverview(), getRollingTotals(), getByCategory(), getByNeighborhood(),
      getDaily(DAILY_DAYS), getDailyBreakdown(DAILY_DAYS), getLatest(6),
      getMonthlyOutcome(), getWeeklySummary(), getResolutionCurve(),
      getOutcomeByCategory(OUTCOME_DAYS), getOutcomeByNeighborhood(OUTCOME_DAYS),
    ]);
  const { byCategory: dailyCat, byNeighborhood: dailyNb } = breakdown;

  const outcomeByCat = new Map(outCat.map((o) => [o.key, o]));
  const outcomeByNb = new Map(outNb.map((o) => [o.key, o]));

  // Pivot per-category daily counts once: the stacked chart needs every day, the
  // sparklines need the trailing 60.
  const days = daily.map((d) => d.day);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const stacked: Day[] = daily.map((d) => ({ day: d.day, total: d.total, byCat: {} }));
  const trend = new Map<string, number[]>(
    CATEGORIES.map((c) => [String(c.id), days.map(() => 0)]),
  );
  for (const r of dailyCat) {
    const i = dayIndex.get(r.day);
    if (i === undefined) continue;
    stacked[i]!.byCat[r.category_id] = r.n;
    const series = trend.get(String(r.category_id));
    if (series) series[i] = r.n;
  }
  // Same pivot for neighbourhoods. Seeded from the ranked rows rather than from a
  // fixed list -- unlike the 16 categories, the set of neighbourhoods is whatever
  // the geometry produced, so the table's own keys are the authority.
  const trendNb = new Map<string, number[]>(
    byNb.map((r) => [r.key, days.map(() => 0)]),
  );
  for (const r of dailyNb) {
    const i = dayIndex.get(r.day);
    if (i === undefined) continue;
    const series = trendNb.get(r.neighborhood);
    if (series) series[i] = r.n;
  }

  const sparkFrom = Math.max(0, days.length - 60);

  const dailyMean = Math.round(daily.reduce((s, d) => s + d.total, 0) / (daily.length || 1));
  const busiest = daily.reduce((a, b) => (b.total > a.total ? b : a), daily[0]!);
  const pctFav = ((overview.favorabil / overview.total) * 100).toFixed(1);
  // The newest day in the data may itself be partial: the sync runs mid-day, and
  // reports keep arriving after it. The day before it is the last certain one.
  const lastComplete = daily.filter((d) => d.day !== overview.last_day).at(-1);

  const lastDay = resolution?.points.at(-1)?.day ?? 0;
  const checkpoints = resolution
    ? resolution.points.filter((p) => p.day === lastDay || CHECKPOINTS.includes(p.day))
    : [];

  const win = `from=${totals.d7.from}&to=${totals.d7.to}`;
  const catHref = (id: string) => `/harta?cat=${id}&${win}`;
  const nbHref = (name: string) =>
    name === '(nelocalizat)' ? `/harta?${win}` : `/harta?cartier=${encodeURIComponent(name)}&${win}`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <header className="pb-6">
        <h1 className="text-xl font-semibold tracking-tight">Panou general</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {nf.format(overview.total)} sesizări publice trimise Primăriei Cluj-Napoca prin
          platforma My Cluj, din {fmtLong(overview.first_day)} până
          în {fmtLong(overview.last_day)}. Preluare zilnică de pe platforma oficială;
          ultima sesizare din oglindă este de la {overview.last_seen}.
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Sesizări pe zi"
        note={`Ultimele ${daily.length} de zile. Sus, câte sesizări au sosit în fiecare zi.
               Jos, cum s-au împărțit pe categorii în acea zi: fiecare coloană însumează 100%,
               așa că ponderile rămân comparabile și în zilele liniștite. Culorile sunt aceleași
               ca pinurile de pe hartă; treci cu mausul peste o zi pentru cifre.`}
      >
        <DailyCategoryChart data={stacked} order={CATEGORIES.map((c) => c.id)} />
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
          <span>Medie: <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{dailyMean}</span>/zi</span>
          <span>
            Vârf: <span className="font-mono tabular-nums text-neutral-700 dark:text-neutral-300">{busiest.total}</span>
            {' '}pe {fmtLong(busiest.day)}
          </span>
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
        title="Volum"
        note={`Ferestrele sunt mobile, nu săptămâni calendaristice, deci sunt întotdeauna
               complete. Reperul este ultima zi acoperită de date (${fmtShort(totals.d7.to)}),
               nu ziua calendaristică. Comparația cu anul trecut este decalată cu 364 de zile,
               ca să cadă pe aceleași zile ale săptămânii.`}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <CountCard
            label="Total, din 2017"
            value={overview.total}
            sub={`din ${fmtLong(overview.first_day)}`}
          />
          <CountCard
            label="Ultimele 7 zile"
            value={totals.d7.cur}
            sub={`${fmtShort(totals.d7.from)} – ${fmtShort(totals.d7.to)} · ${totals.d7.prev} anterior`}
            window={totals.d7}
          />
          <CountCard
            label="Ultimele 30 de zile"
            value={totals.d30.cur}
            sub={`${fmtShort(totals.d30.from)} – ${fmtShort(totals.d30.to)} · ${totals.d30.prev} anterior`}
            window={totals.d30}
          />
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {weekly && (
        <Section
          title="Săptămâna pe scurt"
          note={
            <>
              Text generat automat de un model de limbaj ({weekly.model}) pe baza celor{' '}
              {nf.format(weekly.n_tickets)} sesizări depuse
              între {fmtLong(weekly.period_start)} și {fmtLong(weekly.period_end)}.
              Generat la {weekly.generated_at}. Nu este text redactat de o persoană și
              nu a fost verificat manual; restul cifrelor de pe această pagină vin direct
              din date.
            </>
          }
        >
          <div className="rounded-md border border-neutral-300 p-4 dark:border-neutral-700">
            {weekly.summary.split(/\n\s*\n/).filter(Boolean).map((para, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed first:mt-0">
                {para}
              </p>
            ))}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Pe categorii"
        note={
          <>
            Volumul este pe ultimele 7 zile; apasă pe o categorie ca să o deschizi pe hartă,
            filtrată la fel. Harta poate arăta un număr puțin mai mic: acolo intră doar
            sesizările cu coordonate utile. Linia arată volumul zilnic din ultimele 60 de
            zile, scalată independent pe fiecare rând. Banda „compoziție” acoperă ultimele
            {' '}{OUTCOME_DAYS} de zile — aceeași fereastră ca linia — nu ultimele 7, pentru
            că o sesizare depusă săptămâna asta de obicei nu a primit încă răspuns. Culorile
            sunt cele din legenda de mai jos; treci cu mouse-ul peste bandă pentru procentele
            exacte. Banda gri de la capăt este partea încă nesoluționată: la {OUTCOME_DAYS} de
            zile înseamnă cam un sfert din total, dar între 11% și 38% în funcție de categorie.
            Merită citită înainte de a compara două rânduri — o categorie poate părea mai puțin
            favorabilă doar pentru că are mai multe sesizări încă în lucru.{' '}
            <strong className="font-medium text-neutral-700 dark:text-neutral-300">
              Transport public (CTP) și Rețele de apă/canalizare (CAS) apar aproape integral
              în banda „transferat”
            </strong>{' '}
            — primăria le trimite mai departe și nu mai consemnează un rezultat, deci despre
            ele tabelul spune cine răspunde, nu dacă s-a rezolvat ceva.
          </>
        }
      >
        <RankedTable
          rows={byCat.map((r) => ({
            ...r, label: CATEGORY_BY_ID.get(Number(r.key))?.short ?? r.label,
          }))}
          colorFor={(k) => CATEGORY_BY_ID.get(Number(k))?.color ?? '#888'}
          hrefFor={catHref}
          trendFor={(k) => (trend.get(k) ?? []).slice(sparkFrom)}
          outcomeFor={(k) => outcomeByCat.get(k)}
        />
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Pe cartiere"
        note={
          <>
            Volumul este pe ultimele 7 zile; apasă pe un cartier pentru a-l deschide pe hartă.
            Cartierul este atribuit geometric, din coordonatele sesizării, folosind limitele de
            cartier din OpenStreetMap; sesizările fără coordonate utile apar ca „nelocalizat”
            și nu pot fi filtrate spațial. Linia arată volumul zilnic din ultimele 60 de zile,
            scalată independent pe fiecare rând. Banda „compoziție” acoperă aceeași fereastră
            de {OUTCOME_DAYS} de zile, nu ultimele 7; treci cu mouse-ul peste ea pentru
            procentele exacte, iar banda gri de la capăt este partea încă nesoluționată, cam un
            sfert din total. Diferențele dintre cartiere țin
            în bună măsură de ce se reclamă acolo, nu de cum este tratat cartierul: unde se
            depun multe sesizări de transport sau de apă-canal, ponderea „transferat” crește
            mecanic, pentru că acele categorii pleacă integral la operator.
          </>
        }
      >
        <RankedTable rows={byNb} colorFor={() => '#6b7280'} hrefFor={nbHref}
          trendFor={(k) => (trendNb.get(k) ?? []).slice(sparkFrom)}
          outcomeFor={(k) => outcomeByNb.get(k)} />
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
      {resolution && (
        <Section
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
          <div className="relative">
            <StepCurve points={resolution.points} color={CLOSED_COLOR} />
            {[75, 50, 25].map((v) => (
              <span key={v} aria-hidden="true"
                className="pointer-events-none absolute left-0 -translate-y-1/2 pr-1 text-[10px] tabular-nums text-neutral-400"
                style={{ top: `${100 - v}%` }}>
                {v}%
              </span>
            ))}
          </div>
          {/* Each day owns an equal slice and its step lands on the slice's right
              edge, so right-aligning the labels puts them under their own step. */}
          <div className="mt-1 flex text-[10px] text-neutral-500">
            {resolution.points.map((p) => (
              <span key={p.day} className="flex-1 text-right tabular-nums">{p.day}</span>
            ))}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-400">zile de la depunere</div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <thead className="text-left text-xs text-neutral-500">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="py-1.5 font-medium">Închise în</th>
                  <th className="py-1.5 pr-3 text-right font-medium">estimat închise</th>
                  <th className="py-1.5 font-medium">&nbsp;</th>
                  <th className="py-1.5 pl-3 text-right font-medium">încă în observație</th>
                </tr>
              </thead>
              <tbody>
                {checkpoints.map((p) => (
                  <tr key={p.day} className="border-b border-neutral-100 last:border-0 dark:border-neutral-900">
                    <td className="py-1.5 pr-4 whitespace-nowrap">{p.day} {p.day === 1 ? 'zi' : 'zile'}</td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{p.pct}%</td>
                    <td className="w-1/2 py-1.5">
                      <Bar value={p.pct} max={100} color={CLOSED_COLOR} />
                    </td>
                    <td className="py-1.5 pl-3 text-right font-mono text-xs tabular-nums text-neutral-500">
                      {p.at_risk}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* The risk set is not the denominator of the estimate -- the estimate is
              a running product over every earlier day -- so it is labelled as what
              it is: how much evidence still stands behind that row. */}
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Ultima coloană arată câte sesizări mai erau deschise și încă urmărite la
            începutul acelei zile, nu numărul din care s-a calculat procentul. Cu cât
            scade, cu atât rândul se sprijină pe mai puține observații; zilele rămase
            fără destule sesizări nici nu sunt desenate.
          </p>
        </Section>
      )}

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
            închisă. {resolution ? `Din ${fmtLong(resolution.obs_from)}` : 'De la prima preluare'}{' '}
            înregistrăm tranzițiile pe măsură ce le observăm, iar din ele iese secțiunea
            „Cât de repede se închid” — dar ea nu poate acoperi cele
            {' '}{nf.format(overview.total - overview.open)} de sesizări deja închise la prima
            preluare, pentru care data închiderii nu există nicăieri public.
          </li>
          <li>
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">
              Sub o zi nu putem distinge.
            </strong>{' '}
            Preluarea rulează o dată pe zi, deci o sesizare deschisă și închisă între două
            rulări este văzută direct închisă, fără tranziție observată. Pentru acestea folosim
            momentul primei observări ca limită superioară: știm sigur că s-au închis mai
            devreme de atât, deci curba le numără puțin mai încet decât au fost în realitate,
            niciodată mai repede.
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
            normal, dar apar ca „nelocalizat” la defalcarea pe cartiere.
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
