/* Reading and writing content/ from the pipeline. Everything here writes new
   files only — originals are never touched or re-encoded. */

import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();
export const CONTENT = path.join(ROOT, 'content');
export const POSTS = path.join(CONTENT, 'posts');

/* A post at the same place within this many days of an existing trip extends
   that trip rather than starting a new one. */
export const TRIP_GAP_DAYS = 5;

const DAY = 86400000;

export const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const writeJSON = (p, v) => fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

export const tripsPath = () => path.join(CONTENT, 'trips.json');
export const locationsPath = () => path.join(CONTENT, 'locations.json');

/* HOME lives in src/config.ts (the single tuning module); the pipeline only
   needs its name, to refuse posts that would try to make home a trip. */
export function homeName() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'config.ts'), 'utf8');
  const m = src.match(/export const HOME\s*=\s*\{[^}]*name:\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not read HOME.name from src/config.ts');
  return m[1].toUpperCase();
}

export const placeSlug = (place) =>
  place
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Next free `<date>-<place>-NN` slug. */
export function allocateSlug(date, place, taken = new Set()) {
  const stem = `${date}-${placeSlug(place)}`;
  for (let i = 1; i < 100; i++) {
    const slug = `${stem}-${String(i).padStart(2, '0')}`;
    if (!taken.has(slug) && !fs.existsSync(path.join(POSTS, slug))) return slug;
  }
  throw new Error(`More than 99 posts for ${stem}`);
}

/**
 * Find the trip this post belongs to, extending its range or creating it.
 * Mutates and returns the trips array plus the chosen trip.
 */
export function assignTrip(trips, place, date) {
  const t = Date.parse(`${date}T00:00:00Z`);
  const gap = TRIP_GAP_DAYS * DAY;

  let trip = trips.find(
    (x) =>
      x.place === place &&
      t >= Date.parse(`${x.start}T00:00:00Z`) - gap &&
      t <= Date.parse(`${x.end}T00:00:00Z`) + gap,
  );

  if (trip) {
    if (date < trip.start) trip.start = date;
    if (date > trip.end) trip.end = date;
  } else {
    const year = date.slice(0, 4);
    let id = `${placeSlug(place)}-${year}`;
    for (let i = 2; trips.some((x) => x.id === id); i++) id = `${placeSlug(place)}-${year}-${i}`;
    /* name is a human touch — edit it in content/trips.json afterwards */
    trip = { id, place, name: place.toLowerCase(), start: date, end: date };
    trips.push(trip);
  }

  trips.sort((a, b) => a.start.localeCompare(b.start));
  return trip;
}

/** Trips must not overlap — the geometry lays them out one after another. */
export function assertNoOverlap(trips) {
  const sorted = trips.slice().sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end)
      throw new Error(
        `Trips overlap: "${sorted[i - 1].id}" (${sorted[i - 1].start}→${sorted[i - 1].end}) and ` +
          `"${sorted[i].id}" (${sorted[i].start}→${sorted[i].end}). Fix content/trips.json.`,
      );
  }
}

/** Blank-line-separated paragraphs make it a long-form reflection. */
export const postType = (description) => (/\n\s*\n/.test(description.trim()) ? 'reflection' : 'photo');

/** Write content/posts/<slug>/{photo.<ext>,meta.json}. Never overwrites. */
export function writePost(slug, meta, photo) {
  const dir = path.join(POSTS, slug);
  if (fs.existsSync(dir)) throw new Error(`Post folder already exists: ${dir}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `photo${photo.ext}`), photo.buffer);
  writeJSON(path.join(dir, 'meta.json'), meta);
  return dir;
}

/** Does this trip already have a cover post? */
export function tripHasCover(tripId) {
  if (!fs.existsSync(POSTS)) return false;
  return fs.readdirSync(POSTS).some((slug) => {
    const f = path.join(POSTS, slug, 'meta.json');
    if (!fs.existsSync(f)) return false;
    const m = readJSON(f);
    return m.tripId === tripId && m.cover === true;
  });
}

export function postUrl(slug, siteUrl, basePath) {
  const base = `${(basePath || '/').replace(/\/+$/, '')}/`;
  return `${(siteUrl || '').replace(/\/+$/, '')}${base}p/${slug}/`;
}
