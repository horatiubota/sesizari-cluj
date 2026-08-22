import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrub } from './pii.ts';

// ---------- must be redacted ----------

test('redacts email', () => {
  const r = scrub('va rog contactati adaissa@yahoo.com pentru detalii');
  assert.match(r.text, /\[email\]/);
  assert.equal(r.redactions.email, 1);
});

test('redacts mobile phone, spaced and unspaced', () => {
  for (const p of ['0740165365', '0740 165 365', '0740-165-365', '+40740165365', '0040740165365']) {
    const r = scrub(`sunati la ${p} va rog`);
    assert.match(r.text, /\[telefon\]/, `failed for ${p}`);
  }
});

test('redacts Cluj landline', () => {
  const r = scrub('telefon 0264 405 300 program 8-16');
  assert.match(r.text, /\[telefon\]/);
});

test('redacts CNP', () => {
  const r = scrub('CNP 1920315123456 anexat');
  assert.match(r.text, /\[cnp\]/);
});

test('redacts "Subsemnata <Name>"', () => {
  const r = scrub('Subsemnata Trifoi Anamaria, va adresez prezenta sesizare');
  assert.match(r.text, /Subsemnata \[nume\], va adresez/);
  assert.equal(r.redactions.name, 1);
});

test('redacts full signature block (real sample)', () => {
  const r = scrub(
    'Va rog sa tratati prezenta sesizare cu caracter de urgenta.\n\n' +
      'Cu stima,\n\nAdina Hangea\nStr Campul Painii Nr 12\n0740165365\nadaissa@yahoo.com',
  );
  assert.match(r.text, /\[email\]/);
  assert.match(r.text, /\[telefon\]/);
  assert.doesNotMatch(r.text, /Adina Hangea/);
});

test('redacts bare trailing name line (real sample)', () => {
  const r = scrub('Scriu asta la o ora cand preferam sa dorm.\n\nVasile Andrei.');
  assert.doesNotMatch(r.text, /Vasile Andrei/);
});

// ---------- must NOT be redacted ----------

test('keeps street addresses — they are the subject, not an identifier', () => {
  const s = 'Reabilitare strada Tudor Arghezi intre intersectia cu strada Eugen Ionescu';
  assert.equal(scrub(s).text, s);
});

test('keeps ticket numbers', () => {
  const s = 'In legatura cu sesizarea numar caz: CAS-0213749 si CAS-0210723';
  assert.equal(scrub(s).text, s);
});

test('keeps registration numbers with dates', () => {
  const s = 'conform solutionarii sesizarii 615070/46/22.06.2026 si nr. 732473/20.08.2026';
  assert.equal(scrub(s).text, s);
});

test('keeps legal references and postal codes', () => {
  const s = 'in temeiul art. 6^1 din OG nr. 27/2002, Piata Stefan cel Mare 5, 400394 Cluj-Napoca';
  assert.equal(scrub(s).text, s);
});

test('keeps vehicle plates (subject of abandoned-vehicle reports)', () => {
  const s = 'CJ 28 GVO parcat în fata ghenei de reciclabile, si CJ 20 EGI pe linia 46L';
  assert.equal(scrub(s).text, s);
});

test('keeps times, coordinates and bus numbers', () => {
  const s = 'autobuzul 941 trebuia sa plece la 12:40, coordonate 46.711972 23.547564';
  assert.equal(scrub(s).text, s);
});

test('keeps a place name on the final line', () => {
  const s = 'Este murdar in tot parcul.\nParcul Central';
  assert.equal(scrub(s).text, s);
});

test('keeps address-shaped final line', () => {
  const s = 'Va rog sa interveniti.\nAleea Ciucas 5';
  assert.equal(scrub(s).text, s);
});

test('is idempotent', () => {
  const once = scrub('sunati 0740165365 sau adaissa@yahoo.com');
  assert.equal(scrub(once.text).text, once.text);
});
