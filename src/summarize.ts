import { resolve } from 'node:path';
import pg from 'pg';

/**
 * Weekly narrative summary of incoming reports.
 *
 *   summarize.ts              summarise the last 7 days of data
 *   summarize.ts --days 30    a different window
 *   summarize.ts --dry-run    generate but write nothing
 *   summarize.ts --show-prompt print the exact prompt and exit, calling nothing
 *
 * Runs from a GitHub Action after the sync job and writes one row into
 * public.weekly_summary. Nothing about this touches the web app: Vercel only
 * reads the table, so the API key never reaches a public-facing runtime.
 *
 * Requires SUPABASE_DB_URL and GEMINI_API_KEY.
 */

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.7-flash';
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * How many reports to put in front of the model.
 *
 * A week is ~535 reports, so this is not a sampling limit in normal operation;
 * it is a ceiling so an unusual week cannot produce an unbounded request.
 */
const MAX_TICKETS = 900;
/** Long reports are truncated: the first sentences carry the complaint. */
const MAX_CHARS = 400;

interface Row {
  ticket_number: string;
  category: string;
  neighborhood: string | null;
  day: string;
  description: string | null;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} is not set.`);
    process.exit(1);
  }
  return v;
}

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const PROMPT_HEADER = (days: number, from: string, to: string, n: number): string => `
Ești un analist care rezumă sesizările civice publice trimise Primăriei Cluj-Napoca.

Mai jos sunt ${n} sesizări depuse în ultimele ${days} de zile (${from} – ${to}), fiecare cu
categoria, cartierul și textul depus de cetățean.

Scrie un rezumat în limba română, în 3-5 paragrafe scurte, care să acopere:
- temele dominante ale săptămânii și ce s-a schimbat față de ce ai vedea în mod obișnuit;
- zonele sau străzile care apar repetat, cu numărul de sesizări acolo unde este relevant;
- problemele punctuale care par să afecteze mai mulți oameni sau să se repete.

DATE PERSONALE — reguli absolute. Textele de mai jos sunt scrise de cetățeni și unele
conțin date personale pe care ei le-au introdus. Rezumatul NU are voie să reproducă
niciuna dintre ele, nici măcar parțial sau parafrazat:
- Niciun nume sau prenume de persoană privată, în nicio formă (inclusiv inițiale sau
  nume apărute după formulări ca "pe numele", "subsemnatul", "numele meu este").
  Excepție: demnitarii și funcționarii publici menționați strict în calitatea lor
  oficială (de exemplu primarul) pot fi numiți.
- Niciun număr de telefon, adresă de e-mail, CNP, IBAN sau număr de înmatriculare auto.
- Nicio adresă exactă de locuință: fără număr de imobil, bloc, scară sau apartament.
  Numele de stradă, de cartier și de obiectiv public SUNT permise și chiar necesare —
  ele sunt subiectul sesizărilor, nu date personale.
- Dacă o problemă nu poate fi descrisă fără o astfel de informație, descrie-o generic
  ("un rezident a semnalat...") sau omite-o.

Alte reguli stricte:
- Ton neutru, descriptiv, fără adjective de opinie și fără recomandări către primărie.
- Bazează-te DOAR pe textele de mai jos. Nu inventa cifre, nume de străzi sau instituții
  care nu apar în date. Dacă ceva nu reiese clar din date, nu îl afirma.
- Nu folosi formatare Markdown, doar paragrafe separate prin linie goală.
- Nu începe cu o formulă de introducere de tipul "Iată rezumatul". Începe direct.

Sesizările:
`.trim();

/** Statuses worth retrying: shared-capacity pressure, not a bad request. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * One generation, retried with exponential backoff.
 *
 * The free tier sits on shared capacity and answers 503 "experiencing high
 * demand" often enough that a single attempt is not a reliable weekly job --
 * the first real run hit exactly that. Backoff is generous because nothing is
 * waiting on this: it runs unattended once a week.
 */
async function generate(prompt: string, apiKey: string): Promise<Response> {
  const delays = [5_000, 15_000, 45_000, 90_000];
  let res!: Response;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    res = await fetch(`${API}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8000 },
      }),
    });

    if (res.ok || !RETRYABLE.has(res.status) || attempt === delays.length) return res;

    const wait = delays[attempt]!;
    console.error(`Gemini ${res.status}; retrying in ${wait / 1000}s (attempt ${attempt + 1}/${delays.length})`);
    await new Promise((r) => setTimeout(r, wait));
  }
  return res;
}

async function main(): Promise<void> {
  const dbUrl = required('SUPABASE_DB_URL');
  const apiKey = required('GEMINI_API_KEY');
  const days = Number(arg('--days') ?? 7);
  const dryRun = process.argv.includes('--dry-run');

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Anchored to the newest day in the data, not the wall clock: the sync job
  // runs once a day, so "the last 7 days" from now() would include a day the
  // mirror has not covered yet.
  const { rows } = await client.query<Row>(
    `with anchor as (
       select max((created_at at time zone 'Europe/Bucharest')::date) as today
       from public.tickets
     )
     select t.ticket_number, c.name as category, t.neighborhood,
            (t.created_at at time zone 'Europe/Bucharest')::date::text as day,
            t.description
     from public.tickets t
       join public.categories c on c.id = t.category_id,
       anchor a
     where t.created_at >= ((a.today - $1::int + 1)::timestamp at time zone 'Europe/Bucharest')
     order by t.created_at
     limit $2`,
    [days, MAX_TICKETS],
  );

  if (!rows.length) {
    console.error('No tickets in the window; nothing to summarise.');
    await client.end();
    process.exit(1);
  }

  const periodStart = rows[0]!.day;
  const periodEnd = rows[rows.length - 1]!.day;

  // Sent as stored. Personal data is excluded by instruction in the prompt
  // rather than by a pre-pass: a regex over free text was both leaky and
  // destructive here, redacting shouting and generic wording while still
  // missing names. Note the limit of that choice -- prompt rules govern what
  // comes *out* of the model, not what the provider may do with the input.
  const body = rows
    .map((r) => {
      const text = (r.description ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
      return `- [${r.day}] ${r.category}${r.neighborhood ? ` / ${r.neighborhood}` : ''}: ${text}`;
    })
    .join('\n');

  const prompt = `${PROMPT_HEADER(days, periodStart, periodEnd, rows.length)}\n${body}`;
  console.error(`window ${periodStart}..${periodEnd}, ${rows.length} tickets, ${prompt.length} chars`);

  // Auditable on demand: this is byte-for-byte what is sent to the third party.
  if (process.argv.includes('--show-prompt')) {
    console.log(prompt);
    await client.end();
    return;
  }

  const res = await generate(prompt, apiKey);

  if (!res.ok) {
    console.error(`Gemini returned ${res.status}: ${(await res.text()).slice(0, 500)}`);
    await client.end();
    process.exit(1);
  }

  const json = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: Record<string, number>;
  };
  const candidate = json.candidates?.[0];
  const summary = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();

  if (!summary) {
    // A blank body with a finishReason is a refusal or a truncation, not a bug
    // to paper over with an empty row on the dashboard.
    console.error(`Empty summary (finishReason: ${candidate?.finishReason ?? 'unknown'}).`);
    console.error(JSON.stringify(json.usageMetadata ?? {}));
    await client.end();
    process.exit(1);
  }

  console.error(`usage: ${JSON.stringify(json.usageMetadata ?? {})}`);

  if (dryRun) {
    console.log(summary);
    await client.end();
    return;
  }

  await client.query(
    `insert into public.weekly_summary (period_start, period_end, model, n_tickets, summary)
     values ($1, $2, $3, $4, $5)
     on conflict (period_start, period_end) do update
       set model = excluded.model, n_tickets = excluded.n_tickets,
           summary = excluded.summary, generated_at = now()`,
    [periodStart, periodEnd, MODEL, rows.length, summary],
  );
  console.error(`stored summary for ${periodStart}..${periodEnd} (${summary.length} chars)`);
  await client.end();
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
