/**
 * Copy MapLibre's worker bundle into public/ so it can be served from our own
 * origin.
 *
 * MapLibre 6 no longer inlines its worker. It resolves the worker file at
 * runtime from `import.meta.url`, which Turbopack rewrites to something the
 * resolution cannot use: the URL collapses to an empty string and the browser
 * falls back to the document, producing
 *
 *   Failed to load module script: The server responded with a non-JavaScript
 *   MIME type of "text/html"
 *
 * The worker then never starts. Every tile is parsed off the main thread, so
 * the map stays blank and never fires `load` — no basemap, and no ticket layer
 * either. `setWorkerUrl()` (called in MapExplorer) points it at these copies.
 *
 * Copied at build time rather than vendored so the files cannot drift from the
 * installed version.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'));
const out = join(import.meta.dirname, '..', 'public', 'maplibre');

// The worker imports the shared chunk with a relative specifier, so both files
// have to land in the same directory.
const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

await mkdir(out, { recursive: true });
for (const f of FILES) {
  await copyFile(join(dist, f), join(out, f));
}
console.log(`maplibre worker → public/maplibre/ (${FILES.join(', ')})`);
