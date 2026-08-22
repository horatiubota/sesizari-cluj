import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Configuration and connectivity check.
 *
 * Next hides server errors behind an opaque digest in production, so a missing
 * environment variable and an unreachable database look identical from outside.
 * This reports which one it is without ever revealing the credential.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const url = process.env.SUPABASE_DB_URL;

  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'SUPABASE_DB_URL is not set in this environment',
        fix: 'Add it in Vercel: Project Settings → Environment Variables, then redeploy.',
      },
      { status: 503 },
    );
  }

  // Describe the target without exposing user, password or host.
  let shape = 'unparseable';
  try {
    const u = new URL(url);
    shape = `${u.protocol}//…@${u.hostname.split('.').slice(-3).join('.')}:${u.port || '5432'}`;
  } catch {
    /* leave as unparseable */
  }

  const started = Date.now();
  try {
    const [row] = await query<{ tickets: string; latest: string }>(
      `select (select count(*) from public.tickets)::text as tickets,
              (select max(created_at)::date::text from public.tickets) as latest`,
    );
    return NextResponse.json({
      ok: true,
      target: shape,
      tickets: Number(row?.tickets ?? 0),
      latestTicket: row?.latest,
      queryMs: Date.now() - started,
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    return NextResponse.json(
      {
        ok: false,
        target: shape,
        problem: 'database unreachable or rejecting the connection',
        code: e.code ?? null,
        // Safe: pg error messages describe the failure, not the credential.
        detail: e.message.slice(0, 200),
      },
      { status: 503 },
    );
  }
}
