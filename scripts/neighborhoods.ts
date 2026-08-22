import { readFileSync } from 'node:fs';
import pg from 'pg';

/**
 * Assign each ticket to a Cluj neighbourhood (cartier) by point-in-polygon.
 *
 * Boundaries come from OpenStreetMap (ODbL) and are committed to the repo, so
 * this is reproducible without re-querying Overpass.
 *
 * Strict containment only. OSM maps 15 further neighbourhoods as bare points
 * with no boundary, but they are either sub-areas of a mapped cartier (Micro 1-4
 * sit inside Mănăștur) or industrial fringes. Assigning those by nearest centroid
 * would invent boundaries that do not exist, so anything outside every polygon is
 * left null and reported as such.
 */

interface Feature {
  properties: { name: string };
  geometry: { coordinates: [number, number][][] };
}

const geo = JSON.parse(readFileSync('reference/cluj-neighborhoods.geojson', 'utf8')) as {
  features: Feature[];
};

interface Poly {
  name: string;
  ring: [number, number][];      // [lon, lat]
  minLon: number; maxLon: number; minLat: number; maxLat: number;
}

const polys: Poly[] = geo.features.map((f) => {
  const ring = f.geometry.coordinates[0]!;
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return {
    name: f.properties.name,
    ring,
    minLon: Math.min(...lons), maxLon: Math.max(...lons),
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
  };
});

/** Ray casting. Bounding box is checked first: it rejects most polygons in O(1). */
function inside(lon: number, lat: number, p: Poly): boolean {
  if (lon < p.minLon || lon > p.maxLon || lat < p.minLat || lat > p.maxLat) return false;
  let hit = false;
  const r = p.ring;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]!;
    const [xj, yj] = r[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function locate(lon: number, lat: number): string | null {
  for (const p of polys) if (inside(lon, lat, p)) return p.name;
  return null;
}

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const { rows } = await c.query<{ ticket_number: string; lat: number; lon: number }>(
  `select ticket_number, lat, lon from public.tickets
   where lat is not null and lon is not null and is_default_pin = false`,
);
console.log(`locating ${rows.length} tickets against ${polys.length} polygons`);

const assigned = new Map<string, string>();
let unmatched = 0;
for (const r of rows) {
  const n = locate(r.lon, r.lat);
  if (n) assigned.set(r.ticket_number, n);
  else unmatched++;
}
console.log(`  matched ${assigned.size}, outside all polygons ${unmatched}`);

const entries = [...assigned.entries()];
const BATCH = 2000;
for (let i = 0; i < entries.length; i += BATCH) {
  const slice = entries.slice(i, i + BATCH);
  const tuples = slice.map((_, k) => `($${k * 2 + 1},$${k * 2 + 2})`).join(',');
  await c.query(
    `update public.tickets t set neighborhood = v.n
     from (values ${tuples}) as v(tn, n) where t.ticket_number = v.tn
       and t.neighborhood is distinct from v.n`,
    slice.flat(),
  );
  process.stdout.write(`\r  written ${Math.min(i + BATCH, entries.length)}/${entries.length}`);
}
console.log();

const summary = await c.query(
  `select coalesce(neighborhood,'(nemarcat)') n, count(*)::int tickets
   from public.tickets where not is_default_pin and lat is not null
   group by 1 order by 2 desc`,
);
console.log('\nTICKETS BY NEIGHBOURHOOD');
for (const r of summary.rows) console.log(`  ${String(r.tickets).padStart(7)}  ${r.n}`);
await c.end();
