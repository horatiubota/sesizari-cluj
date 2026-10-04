import { CATEGORY_BY_ID } from '@/lib/categories';
import { nf, oneIn, pct, sesizari } from '@/lib/outcomes';

/** "43 de" / "17": Romanian takes "de" before the noun from 20 up (and at round hundreds). */
const de = (n: number) => { const t = n % 100; return `${nf.format(n)}${t === 0 || t >= 20 ? ' de' : ''}`; };
import type { Findings } from '@/lib/replies';

/**
 * The four findings the dashboard leads with, and the sections that carry
 * their evidence.
 *
 * Tone is deadpan by design (PRODUCT.md): the city's own label next to the
 * city's own words, a number, and at most one short verdict line per section.
 * Every verdict is generated from the numbers it states, so it cannot drift
 * out of date or claim more than the data shows.
 */

const MYCLUJ = (t: string) => `https://mycluj.e-primariaclujnapoca.ro/?c=${t}`;
const MONTH_YEAR = new Intl.DateTimeFormat('ro-RO', { month: 'short', year: 'numeric' });
const DATE_LONG = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
const monthYear = (iso: string) => MONTH_YEAR.format(new Date(`${iso}T12:00:00`));
const dateLong = (iso: string) => DATE_LONG.format(new Date(`${iso}T12:00:00`));

/** Upstream replies carry literal "\r\n" sequences and a "Trimis Raspuns" prefix. */
export function cleanReply(s: string): string {
  return s.replace(/\\r\\n|\\n|\r\n/g, ' ').replace(/^\s*Trimis Raspuns\s*/i, '').replace(/\s+/g, ' ').trim();
}

/** The source line every chart carries. */
export function Source({ note }: { note?: string }) {
  return (
    <p className="mt-3 font-cond text-xs text-ink-3">
      Sursa: My Cluj, Primăria Cluj-Napoca; calcule Sesizări Cluj.{note ? ` ${note}` : ''}
    </p>
  );
}

const nofixTotal = (f: Findings) => f.nofix.deferred + f.nofix.empty + f.nofix.dispecerat;

function TicketLink({ t }: { t: string }) {
  return (
    <a href={MYCLUJ(t)} target="_blank" rel="noreferrer"
      className="relative inline-block py-1 text-xs text-ink-2 tabular-nums underline decoration-line-strong underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] hover:text-ink">
      {t}
    </a>
  );
}

/** The city's verdict on itself, set apart from everything this site says. */
export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-ink px-1.5 py-0.5 text-xs leading-none font-semibold tracking-wide text-ink uppercase">
      {children}
    </span>
  );
}

/** A reply quoted as evidence: the text itself, not a paraphrase. */
function Quote({ text, clamp = true }: { text: string; clamp?: boolean }) {
  return (
    <blockquote className={`max-w-[72ch] font-serif text-[15px] leading-relaxed text-ink ${clamp ? 'line-clamp-4' : ''}`}>
      {text ? <>„{text}”</> : <span className="text-ink-3 italic">(fără niciun text)</span>}
    </blockquote>
  );
}

export function FindingSection({ id, title, verdict, note, children }: {
  id: string; title: string; verdict: string; note?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="tagged mt-6 scroll-mt-28 pt-5 pb-4">
      {/* The verdict is the heading. `title` names the section only for the
          landmark and the in-page anchors -- a label printed above the verdict
          would be an eyebrow, which the house style does not use. */}
      <h2 id={`${id}-t`} className="headline max-w-[36ch] text-[1.75rem] leading-[1.15] sm:text-[2rem]">
        <span className="sr-only">{title}: </span>{verdict}
      </h2>
      {note && <div className="mt-2 max-w-[68ch] text-sm leading-relaxed text-ink-2">{note}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** The four headline numbers. Each links to the section holding its evidence. */
export function HeadlineFindings({ f, weeks }: { f: Findings; weeks: number }) {
  const nf_ = nofixTotal(f);
  const items = [
    {
      href: '#sabloane', value: pct(f.templated, f.closed),
      label: `din sesizările închise au primit unul din cele ${de(f.templates)} răspunsuri-șablon`,
      detail: f.top[0] ? `Cel mai folosit a fost trimis de ${de(f.top[0].n)} ori.` : '',
    },
    {
      href: '#favorabil-dar', value: oneIn(f.favorabil ? nf_ / f.favorabil : 0),
      label: 'sesizări închise „Favorabil” nu spun că s-a rezolvat ceva',
      detail: `${nf.format(nf_)} din ${nf.format(f.favorabil)}: doar transmise mai departe, amânate, sau fără text.`,
    },
    {
      href: '#raportat-din-nou', value: nf.format(f.recurring.places),
      label: 'locuri cu aceeași categorie de problemă de infrastructură, raportată în cel puțin trei ani diferiți',
      detail: `Închisă „Favorabil” de cel puțin 3 ori, în ${sesizari(f.recurring.reports)}.`,
    },
    {
      href: '#deschise', value: nf.format(f.open.d90),
      label: 'sesizări încă deschise după mai mult de 90 de zile',
      detail: `${nf.format(f.open.y1)} de peste un an.${f.open.oldest[0] ? ` Cea mai veche: ${dateLong(f.open.oldest[0].filed)}.` : ''}`,
    },
  ];
  return (
    <div>
      <p className="text-xs text-ink-3">Ultimele {weeks} săptămâni, cu excepția celor marcate altfel.</p>
      <ol className="mt-3 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.href} className="min-w-0 border-t-2 border-ink pt-3">
            <a href={it.href} className="group block">
              <span className="block font-cond text-[3rem] leading-none font-bold text-alarm tabular-nums">{it.value}</span>
              <span className="mt-2 block text-[15px] leading-snug font-medium text-balance group-hover:underline group-hover:underline-offset-4">{it.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-3">{it.detail}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TemplatesSection({ f, weeks }: { f: Findings; weeks: number }) {
  return (
    <FindingSection id="sabloane" title="Ce răspunde Primăria"
      verdict={`${pct(f.templated, f.closed)} din răspunsuri sunt unul din cele ${de(f.templates)} texte refolosite.`}
      note={<>Cele mai trimise răspunsuri din ultimele {weeks} săptămâni, cu textul lor complet și
        eticheta pe care au primit-o. Un text e „șablon” dacă a fost trimis de cel puțin 10 ori,
        identic în primele 200 de litere, fără numere, date și formule de politețe.</>}>
      <ol className="divide-y divide-line border-y border-line">
        {f.top.map((t, i) => (
          <li key={i} className="grid gap-x-6 gap-y-2 py-5 sm:grid-cols-[7rem_1fr]">
            <div className="flex items-baseline gap-2 sm:block">
              <span className="font-cond text-[2rem] leading-none font-bold text-alarm tabular-nums">{nf.format(t.n)}×</span>
              <span className="text-xs text-ink-3 sm:mt-1 sm:block">în {weeks} săpt.</span>
            </div>
            <div className="min-w-0">
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <Quote text={cleanReply(t.text)} />
                  <span className="mt-1 inline-block text-xs text-ink-2 underline decoration-line-strong underline-offset-4 group-open:hidden">
                    Tot textul
                  </span>
                </summary>
                <div className="mt-2 hidden group-open:block"><Quote text={cleanReply(t.text)} clamp={false} /></div>
              </details>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Label>{t.label}</Label>
                <span className="text-xs text-ink-3">exemple:</span>
                {t.tickets.map((tk) => <TicketLink key={tk} t={tk} />)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </FindingSection>
  );
}

const KIND_COPY = {
  deferred: 'doar transmisă mai departe sau amânată',
  empty: 'fără niciun text',
  dispecerat: '„Soluționat prin dispecerat”',
} as const;

export interface CategoryRate { name: string; value: number }

/**
 * Horizontal bars to a fixed 0-60% scale with the city average drawn across
 * them. Categories above the average take the alarm colour; the rest are the
 * ordinary data colour. Values are printed on the bars, and the whole chart is
 * also a list for screen readers.
 */
function CategoryChart({ rows, avg, title, sub }: { rows: CategoryRate[]; avg: number; title: string; sub: string }) {
  // Headroom past the longest bar so its printed value never runs off a phone screen.
  const max = Math.max(60, Math.ceil((Math.max(...rows.map((r) => r.value), avg) * 1.25) / 20) * 20);
  const ticks = Array.from({ length: max / 20 + 1 }, (_, i) => i * 20);
  const pctLabel = (v: number) => `${v.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return (
    <figure className="tagged mt-8 pt-3">
      <figcaption>
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block font-cond text-sm text-ink-3">{sub}</span>
      </figcaption>
      <div className="relative mt-6 font-cond text-[13px]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 left-[8.5rem]">
          {ticks.map((t) => (
            <span key={t} className="absolute inset-y-0 border-l border-line" style={{ left: `${(t / max) * 100}%` }} />
          ))}
          <span className="absolute inset-y-0 border-l-[1.5px] border-dashed border-ink" style={{ left: `${(avg / max) * 100}%` }}>
            <span className="absolute -top-5 left-1 whitespace-nowrap text-xs font-medium">media orașului {pctLabel(avg)}</span>
          </span>
        </div>
        <ul className="relative grid gap-1.5" aria-label={`${title}: ${rows.map((r) => `${r.name} ${pctLabel(r.value)}`).join(', ')}`}>
          {rows.map((r) => (
            <li key={r.name} className="grid grid-cols-[8rem_1fr] items-center gap-2" aria-hidden="true">
              <span className="truncate text-right text-ink-2">{r.name}</span>
              <span className="relative h-4">
                <span className={`absolute inset-y-0 left-0 ${r.value > avg ? 'bg-alarm' : 'bg-chart'}`}
                  style={{ width: `${(r.value / max) * 100}%` }} />
                <span className="absolute top-1/2 ml-1 -translate-y-1/2 bg-bg px-0.5 text-xs tabular-nums"
                  style={{ left: `${(r.value / max) * 100}%` }}>{pctLabel(r.value)}</span>
              </span>
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="relative mt-1 ml-[8.5rem] h-4 text-xs text-ink-3 tabular-nums">
          {ticks.map((t, i) => (
            <span key={t} className="absolute"
              style={{ left: `${(t / max) * 100}%`, transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
              {t}%
            </span>
          ))}
        </div>
      </div>
      <Source />
    </figure>
  );
}

export function FavorabilSection({ f, byCategory }: { f: Findings; byCategory: CategoryRate[] }) {
  const n = nofixTotal(f);
  const parts = [
    { key: 'deferred', n: f.nofix.deferred },
    { key: 'empty', n: f.nofix.empty },
    { key: 'dispecerat', n: f.nofix.dispecerat },
  ] as const;
  return (
    <FindingSection id="favorabil-dar" title="„Favorabil”, dar…"
      verdict={`${oneIn(f.favorabil ? n / f.favorabil : 0)} sesizări închise „Favorabil” nu spun că s-a rezolvat ceva.`}
      note={<>Din cele {nf.format(f.favorabil)} închise „Favorabil”: răspunsuri care doar anunță că sesizarea
        a fost trimisă altcuiva sau că ceva se va face, fără să spună că s-a intervenit, plus cele fără text.
        Regula e o estimare, verificată manual — vezi <a href="#metoda" className="underline underline-offset-2 hover:text-ink">metoda</a>.</>}>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
        {parts.map((p) => (
          <div key={p.key} className="border-t border-line pt-2">
            <dt className="text-xs text-ink-3">{KIND_COPY[p.key]}</dt>
            <dd className="mt-1 font-cond text-[1.75rem] leading-none font-bold tabular-nums">{nf.format(p.n)}</dd>
          </div>
        ))}
      </dl>
      {byCategory.length > 0 && (
        <CategoryChart rows={byCategory} avg={f.favorabil ? (100 * n) / f.favorabil : 0}
          title="„Favorabil” fără rezolvare declarată"
          sub="% din închiderile „Favorabil”, pe categorii, ultimele 13 săptămâni; categorii cu cel puțin 150 de sesizări" />
      )}
      <h3 className="mt-10 text-sm font-semibold">Cele mai recente exemple</h3>
      <ul className="mt-3 grid gap-4 md:grid-cols-3">
        {f.examples.map((e) => (
          <li key={e.kind} className="flex flex-col rounded-md border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <Label>Favorabil</Label>
              <span>{CATEGORY_BY_ID.get(e.category_id)?.short}</span>
            </div>
            <div className="mt-3 flex-1"><Quote text={cleanReply(e.text)} /></div>
            <div className="mt-3"><TicketLink t={e.ticket} /></div>
          </li>
        ))}
      </ul>
    </FindingSection>
  );
}

export function RecurringSection({ f }: { f: Findings }) {
  return (
    <FindingSection id="raportat-din-nou" title="Rezolvat, raportat din nou"
      verdict={`${de(f.recurring.places)} locuri cu aceeași categorie de problemă, reclamată în cel puțin trei ani diferiți.`}
      note={<>În fiecare loc, cel puțin trei sesizări au fost închise „Favorabil”. Doar categorii de infrastructură (iluminat, străzi, semnalizare, apă, construcții), unde o
        sesizare repetată înseamnă că problema nu a rămas rezolvată. Un „loc” are o rază de aproximativ 11 metri.</>}>
      <ol className="divide-y divide-line border-y border-line">
        {f.recurring.top.map((p, i) => (
          <li key={i} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[1fr_auto] sm:items-baseline">
            <div className="min-w-0">
              <div className="text-[15px] font-medium">
                {CATEGORY_BY_ID.get(p.category_id)?.name} · {p.neighborhood ?? 'Fără cartier'}
              </div>
              <div className="mt-0.5 text-sm text-ink-2 tabular-nums">
                {sesizari(p.n)} în {p.years} ani ({monthYear(p.first)} – {monthYear(p.last)}), dintre care{' '}
                <span className="font-semibold text-ink">{nf.format(p.n_favorabil)} închise „Favorabil”</span>
              </div>
            </div>
            {p.ticket && <TicketLink t={p.ticket} />}
          </li>
        ))}
      </ol>
      <a href="/recurente" className="mt-4 inline-block text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink">
        Toate locurile cu probleme recurente (criteriu mai larg: cel puțin 5 sesizări în cel puțin 3 ani diferiți, indiferent de etichetă)
      </a>
    </FindingSection>
  );
}

export function OpenSection({ f }: { f: Findings }) {
  const buckets = [
    { label: 'sub 90 de zile', n: f.open.total - f.open.d90 },
    { label: '90 de zile – un an', n: f.open.d90 - f.open.y1 },
    { label: 'peste un an', n: f.open.y1 },
  ];
  return (
    <FindingSection id="deschise" title="Încă deschise"
      verdict={`${nf.format(f.open.d90)} de sesizări așteaptă de peste 90 de zile.`}
      note={<>Toate sesizările încă deschise, indiferent de când au fost depuse ({nf.format(f.open.total)}).</>}>
      <dl className="grid grid-cols-3 gap-x-6">
        {buckets.map((b, i) => (
          <div key={b.label} className="border-t border-line pt-2">
            <dt className="text-xs text-ink-3">{b.label}</dt>
            <dd className={`mt-1 font-cond text-[1.75rem] leading-none font-bold tabular-nums ${i ? 'text-alarm' : ''}`}>{nf.format(b.n)}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-8 text-sm font-semibold">Cele mai vechi</h3>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {f.open.oldest.map((o) => (
          <li key={o.ticket} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <span className="text-sm">
              <span className="font-medium tabular-nums">{dateLong(o.filed)}</span>
              <span className="text-ink-2"> · {CATEGORY_BY_ID.get(o.category_id)?.short} · {o.neighborhood ?? 'fără cartier'}</span>
            </span>
            <span className="flex items-center gap-3"><Label>{o.label === 'In lucru' ? 'În lucru' : o.label}</Label><TicketLink t={o.ticket} /></span>
          </li>
        ))}
      </ul>
    </FindingSection>
  );
}
