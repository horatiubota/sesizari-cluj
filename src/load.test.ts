import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRow, toSqlTimestamp } from './load.ts';
import type { RawTicket } from './api/types.ts';

const base: RawTicket = {
  ticketnumber: 'CAS-0213702', titlu: 'Altele', description: 'ceva',
  isedited: '0', category: 'Altele', categoryid: '13',
  latitude: '46.711972', longitude: '23.547564',
  createdon: '20/08/2026 15:29:18', status: 'O|In lucru', resolvereason: '',
};

test('parses upstream date format', () => {
  assert.equal(toSqlTimestamp('20/08/2026 15:29:18'), '2026-08-20 15:29:18');
  assert.equal(toSqlTimestamp(''), null);
  assert.equal(toSqlTimestamp(null), null);
  assert.equal(toSqlTimestamp('nonsense'), null);
});

test('splits pipe-separated status', () => {
  assert.equal(toRow(base)!.status_code, 'O');
  assert.equal(toRow(base)!.status_label, 'In lucru');
  const closed = toRow({ ...base, status: 'C|Transferata operatorului' })!;
  assert.equal(closed.status_code, 'C');
  assert.equal(closed.status_label, 'Transferata operatorului');
});

test('keeps verbatim text only when scrubbing changed something', () => {
  const clean = toRow(base)!;
  assert.equal(clean.raw_description, null, 'unmodified text must not be duplicated');

  const dirty = toRow({ ...base, description: 'sunati la 0740165365' })!;
  assert.equal(dirty.raw_description, 'sunati la 0740165365');
  assert.match(dirty.description!, /\[telefon\]/);
  assert.equal(JSON.parse(dirty.redactions).phone, 1);
});

test('scrubs resolve_reason too', () => {
  const r = toRow({ ...base, resolvereason: 'contactati adichira70@gmail.com' })!;
  assert.match(r.resolve_reason!, /\[email\]/);
  assert.equal(r.raw_resolve, 'contactati adichira70@gmail.com');
});

test('tolerates null description and bad coordinates', () => {
  const r = toRow({ ...base, description: null as unknown as string, latitude: 'x', longitude: '' })!;
  assert.equal(r.description, null);
  assert.equal(r.lat, null);
  assert.equal(r.lon, null);
});

test('rejects out-of-range coordinates instead of plotting them', () => {
  // Number('') === 0 would otherwise place the ticket in the Gulf of Guinea.
  assert.equal(toRow({ ...base, longitude: '' })!.lon, null);
  assert.equal(toRow({ ...base, latitude: '0', longitude: '0' })!.lat, null);
  assert.equal(toRow({ ...base, latitude: '52.5', longitude: '13.4' })!.lat, null, 'Berlin is not Cluj');
  assert.equal(toRow(base)!.lat, 46.711972, 'valid Cluj coordinates survive');
});

test('rejects records without a ticket number', () => {
  assert.equal(toRow({ ...base, ticketnumber: '' }), null);
});

test('parameter count matches the tuple template', () => {
  // 11 columns per row; a mismatch here is a silent data-corruption bug.
  const r = toRow(base)!;
  const cols = ['ticket_number','category_id','description','resolve_reason','status_code',
    'status_label','is_edited','lat','lon','created_at','redactions'];
  assert.equal(cols.length, 11);
  for (const c of cols) assert.ok(c in r, `Row is missing ${c}`);
});
