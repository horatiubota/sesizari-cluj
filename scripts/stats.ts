import { DatabaseSync } from 'node:sqlite';
import { scrub } from '../src/scrub/pii.ts';
import type { RawTicket } from '../src/api/types.ts';

/**
 * Quality assurance over the local crawl: completeness, distributions, and a
 * grounded projection of the Postgres footprint (which decides whether the
 * Supabase free tier is viable).
 */

const db = new DatabaseSync(process.env.MYCLUJ_DB ?? 'data/mycluj.db');
const q = <T>(sql: string, ...p: unknown[]): T[] => db.prepare(sql).all(...(p as [])) as T[];
const one = <T>(sql: string): T => db.prepare(sql).get() as T;

const n = one<{ n: number }>('SELECT COUNT(*) n FROM tickets_raw').n;
const obs = one<{ n: number }>('SELECT COUNT(*) n FROM ticket_observations').n;
const win = one<{ n: number }>('SELECT COUNT(*) n FROM fetch_log').n;

console.log('='.repeat(64));
console.log(`tickets ${n}   observations ${obs}   windows crawled ${win}`);
console.log('='.repeat(64));

// ---- completeness: ticket numbers are sequential, so gaps are measurable ----
const nums = q<{ ticket_number: string }>('SELECT ticket_number FROM tickets_raw')
  .map((r) => Number(r.ticket_number.replace(/\D/g, '')))
  .filter((x) => Number.isFinite(x))
  .sort((a, b) => a - b);

const lo = nums[0]!;
const hi = nums.at(-1)!;
const span = hi - lo + 1;
console.log('\nCOMPLETENESS');
console.log(`  ticket range   : CAS-${String(lo).padStart(7, '0')} .. CAS-${String(hi).padStart(7, '0')}`);
console.log(`  span           : ${span} numbers`);
console.log(`  present        : ${nums.length} (${((100 * nums.length) / span).toFixed(1)}% of span)`);
console.log(`  absent         : ${span - nums.length}`);
console.log('  (absent numbers are expected: non-public tickets, other intake channels)');

// largest contiguous runs of missing ids — a clustered gap would signal a crawl hole
const present = new Set(nums);
let runStart = -1;
const gaps: Array<{ from: number; to: number; len: number }> = [];
for (let i = lo; i <= hi + 1; i++) {
  if (!present.has(i) && i <= hi) {
    if (runStart < 0) runStart = i;
  } else if (runStart >= 0) {
    gaps.push({ from: runStart, to: i - 1, len: i - runStart });
    runStart = -1;
  }
}
gaps.sort((a, b) => b.len - a.len);
console.log(`  gap runs       : ${gaps.length}, largest ${gaps.slice(0, 5).map((g) => g.len).join(', ')}`);

// ---- distributions + sizing, streamed ----
let bytesDesc = 0;
let bytesResolve = 0;
let scrubbedRecords = 0;
let rawKeepBytes = 0;
let nullDesc = 0;
const byYear: Record<string, number> = {};
const byCategory: Record<string, number> = {};
const byStatus: Record<string, number> = {};
const redTotals: Record<string, number> = { email: 0, phone: 0, cnp: 0, iban: 0, name: 0 };

const BATCH = 5000;
for (let off = 0; ; off += BATCH) {
  const rows = q<{ payload: string }>('SELECT payload FROM tickets_raw LIMIT ? OFFSET ?', BATCH, off);
  if (rows.length === 0) break;
  for (const row of rows) {
    const t = JSON.parse(row.payload) as RawTicket;
    const desc = t.description ?? '';
    if (t.description == null) nullDesc++;

    bytesDesc += Buffer.byteLength(desc, 'utf8');
    bytesResolve += Buffer.byteLength(t.resolvereason ?? '', 'utf8');

    const r = scrub(desc);
    for (const k of Object.keys(redTotals)) redTotals[k]! += r.redactions[k as keyof typeof r.redactions];
    if (r.text !== desc) {
      scrubbedRecords++;
      rawKeepBytes += Buffer.byteLength(desc, 'utf8');
    }

    byYear[t.createdon?.slice(6, 10) ?? '?'] = (byYear[t.createdon?.slice(6, 10) ?? '?'] ?? 0) + 1;
    byCategory[t.category ?? '?'] = (byCategory[t.category ?? '?'] ?? 0) + 1;
    byStatus[t.status ?? '?'] = (byStatus[t.status ?? '?'] ?? 0) + 1;
  }
}

const MB = (b: number): string => `${(b / 1e6).toFixed(1)} MB`;

console.log('\nBY YEAR');
for (const [y, c] of Object.entries(byYear).sort())
  console.log(`  ${y}  ${String(c).padStart(6)}  ${'█'.repeat(Math.round(c / 700))}`);

console.log('\nBY STATUS');
for (const [s, c] of Object.entries(byStatus).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(c).padStart(7)}  ${s}`);

console.log('\nTOP CATEGORIES');
for (const [k, c] of Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8))
  console.log(`  ${String(c).padStart(7)}  ${k}`);

console.log('\nPII SCRUBBING');
console.log(`  records modified : ${scrubbedRecords} (${((100 * scrubbedRecords) / n).toFixed(2)}%)`);
console.log(`  redactions       : ${JSON.stringify(redTotals)}`);
console.log(`  null descriptions: ${nullDesc}`);

// Postgres projection. Per-row overhead ~24B header + ~120B for the fixed
// columns; the GIN expression index runs ~55% of indexed text in practice.
const tableBytes = bytesDesc + bytesResolve + n * 145;
const ginBytes = bytesDesc * 0.55;
const eventBytes = obs * 130;
const otherIdx = n * 90;
const total = tableBytes + ginBytes + eventBytes + otherIdx + rawKeepBytes;

console.log('\nPROJECTED POSTGRES FOOTPRINT');
console.log(`  tickets table      ${MB(tableBytes)}   (descriptions ${MB(bytesDesc)})`);
console.log(`  FTS GIN index      ${MB(ginBytes)}`);
console.log(`  ticket_events      ${MB(eventBytes)}   (${obs} rows)`);
console.log(`  other indexes      ${MB(otherIdx)}`);
console.log(`  private.ticket_raw ${MB(rawKeepBytes)}   (only the ${scrubbedRecords} modified records)`);
console.log(`  ${'-'.repeat(46)}`);
console.log(`  TOTAL              ${MB(total)}  of 500 MB Supabase free tier`);
console.log(`  headroom           ${(100 - (100 * total) / 500e6).toFixed(0)}%`);

db.close();
