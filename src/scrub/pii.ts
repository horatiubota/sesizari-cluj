/**
 * PII scrubbing for citizen-authored complaint text.
 *
 * The verbatim original is always retained in `private.ticket_raw`, which is not
 * exposed through PostgREST and never leaves the database. This module produces
 * the *public* rendering: the one that gets indexed, served and dumped.
 *
 * Design bias: mechanical, high-confidence patterns only. Street addresses are
 * deliberately KEPT — they are the subject of the complaint, not an identifier,
 * and removing them would gut the dataset's usefulness.
 */

export type RedactionKind = 'email' | 'phone' | 'cnp' | 'iban' | 'name';

export interface ScrubResult {
  text: string;
  redactions: Record<RedactionKind, number>;
}

const PLACEHOLDER: Record<RedactionKind, string> = {
  email: '[email]',
  phone: '[telefon]',
  cnp: '[cnp]',
  iban: '[iban]',
  name: '[nume]',
};

// Romanian uppercase incl. both comma-below (ȘȚ) and legacy cedilla (ŞŢ) encodings,
// which appear mixed in this dataset.
const RO_UPPER = 'A-ZĂÂÎȘȚŞŢ';
const RO_LOWER = 'a-zăâîșțşţ';

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Romanian mobile (07xx) and landline (02xx/03xx), optionally +40/0040 prefixed.
// Lookarounds prevent biting into longer digit runs (registration numbers, dates).
const PHONE_RE =
  /(?<![\d/])(?:(?:\+|00)?40[\s.-]?|0)(?:7\d{2}|2\d{2}|3\d{2})[\s.-]?\d{3}[\s.-]?\d{3}(?![\d/])/g;

// Cod Numeric Personal: 13 digits, first digit 1-8.
const CNP_RE = /(?<!\d)[1-8]\d{12}(?!\d)/g;

const IBAN_RE = /\bRO\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){4,5}\b/gi;

// "Subsemnata Trifoi Anamaria, ..." — a highly reliable Romanian formal-letter
// self-identification. Captures the following 2-4 capitalised words.
const SUBSEMNAT_RE = new RegExp(
  `\\b(Subsemnat(?:ul|a|ei|ului)?)\\s+((?:[${RO_UPPER}][${RO_LOWER}]+\\s+){1,3}[${RO_UPPER}][${RO_LOWER}]+)`,
  'g',
);

/** Closing salutations after which a trailing signature block commonly appears. */
const CLOSINGS = [
  'cu stima', 'cu stimă', 'cu respect', 'cu deosebita stima', 'cu deosebită stimă',
  'cu consideratie', 'cu considerație', 'multumesc', 'mulțumesc', 'va multumesc',
  'vă mulțumesc', 'multumesc anticipat', 'mulțumesc anticipat', 'cu drag', 'toate cele bune',
];

/**
 * Leading words that disqualify a line from being read as a person's name.
 * Guards place names ("Parcul Central") and stock sign-offs ("Multumesc Frumos")
 * from being mistaken for signatures. Compared diacritic-folded and lowercased.
 */
const NOT_A_NAME_FIRST_WORD = new Set([
  'strada', 'str', 'bulevardul', 'bd', 'aleea', 'calea', 'piata', 'parcul',
  'cartierul', 'soseaua', 'intrarea', 'splaiul', 'drumul', 'blocul', 'scara',
  'multumesc', 'multumim', 'va', 'cu', 'toate', 'numai', 'este', 'sunt', 'buna',
  'o', 'in', 'la', 'pe', 'de', 'si', 'sper', 'astept', 'rog', 'doamna', 'domnule',
  // Places. "Cluj-Napoca" is two capitalised words and otherwise reads as a name.
  'cluj', 'napoca', 'romania', 'bucuresti', 'floresti', 'apahida', 'baciu', 'chinteni',
  'manastur', 'marasti', 'gheorgheni', 'zorilor', 'grigorescu', 'borhanci', 'someseni',
  'dambul', 'iris', 'bulgaria', 'andrei', 'centru', 'gara', 'plopilor', 'buna',
]);

const NAME_LINE_RE = new RegExp(
  `^[${RO_UPPER}][${RO_LOWER}]+(?:[-\\s][${RO_UPPER}][${RO_LOWER}]+){1,2}\\.?$`,
);

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[şș]/gi, 's').replace(/[ţț]/gi, 't');
}

/**
 * Redact person names appearing in a trailing signature block.
 *
 * Conservative by construction: only fires on lines in the final stretch of the
 * text, only on lines that are *nothing but* a name-shaped string, and only when
 * the text actually looks signed — either a closing salutation appears, or the
 * block already yielded a phone/email redaction.
 */
function scrubSignature(text: string, alreadyRedactedContact: boolean): { text: string; count: number } {
  const lines = text.split('\n');
  if (lines.length < 2) return { text, count: 0 };

  const tailStart = Math.max(0, lines.length - 6);
  const tail = lines.slice(tailStart).map((l) => stripDiacritics(l.trim().toLowerCase()));
  const hasClosing = tail.some((l) =>
    CLOSINGS.some((c) => {
      const cc = stripDiacritics(c);
      return l === cc || l === `${cc},` || l === `${cc}!` || l === `${cc}.` || l.startsWith(`${cc},`);
    }),
  );

  // Index of the last non-empty line: a name sitting there is a signature even
  // when the author used no closing salutation at all.
  let lastNonEmpty = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.trim()) { lastNonEmpty = i; break; }
  }

  let count = 0;
  for (let i = tailStart; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.trim();
    if (!t || t.length > 40) continue;

    const anchored = hasClosing || alreadyRedactedContact || i === lastNonEmpty;
    if (!anchored) continue;

    const bare = t.replace(/\.$/, '');
    if (!NAME_LINE_RE.test(bare)) continue;

    const firstWord = stripDiacritics(bare.split(/[\s-]+/)[0] ?? '').toLowerCase();
    if (NOT_A_NAME_FIRST_WORD.has(firstWord)) continue;

    lines[i] = line.replace(t, PLACEHOLDER.name);
    count++;
  }
  return { text: lines.join('\n'), count };
}

export function scrub(input: string | null | undefined): ScrubResult {
  const redactions: Record<RedactionKind, number> = {
    email: 0, phone: 0, cnp: 0, iban: 0, name: 0,
  };
  // The endpoint returns null descriptions for a small share of records.
  let text = input ?? '';

  const apply = (re: RegExp, kind: RedactionKind): void => {
    text = text.replace(re, () => {
      redactions[kind]++;
      return PLACEHOLDER[kind];
    });
  };

  // Order matters: IBAN and CNP before phone, so long digit runs are consumed first.
  apply(EMAIL_RE, 'email');
  apply(IBAN_RE, 'iban');
  apply(CNP_RE, 'cnp');
  apply(PHONE_RE, 'phone');

  text = text.replace(SUBSEMNAT_RE, (_m, prefix: string) => {
    redactions.name++;
    return `${prefix} ${PLACEHOLDER.name}`;
  });

  const sig = scrubSignature(text, redactions.phone + redactions.email > 0);
  text = sig.text;
  redactions.name += sig.count;

  return { text, redactions };
}

export function hasRedactions(r: Record<RedactionKind, number>): boolean {
  return Object.values(r).some((n) => n > 0);
}
