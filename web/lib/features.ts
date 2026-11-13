/**
 * Feature switches.
 *
 * /recurente is switched off rather than deleted while we decide whether to
 * keep it. With the flag false the page answers 404 before touching the
 * database, /api/recurrence does the same, and the nav link is hidden. The
 * sync workflow no longer revalidates or warms the page either; flip this back
 * and restore '/recurente' in app/api/revalidate/route.ts and the warm loop in
 * .github/workflows/sync.yml to re-enable it.
 */
export const RECURENTE_ENABLED = false;
