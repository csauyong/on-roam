/* The single source for social captions — used by the issue comment (Phase 2)
   and by the Instagram / Threads posts (Phase 3). Edit freely.

   The caption reads as a log entry, not a blurb: where and when stated plainly
   first, then the title, then the description on a line of its own. No link
   (the site is the archive; the post is the post) and no hashtags.

     ROAM LOG · PARIS
     48.86°N 2.35°E — 13 February 2026

     Zinc rooftops at six

     The light came down the chimney pots and stayed there. */

/* Placeholders: {place} {dateline} {title} {description} */
export const TEMPLATE = 'ROAM LOG · {place}\n{dateline}\n\n{title}\n\n{description}';

/* Coordinates + date. A place with no geocode yet falls back to the date
   alone, so the second line never dangles a stray dash. */
export const DATELINE = '{coords} — {date-long}';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* 13 February 2026 */
export function dateLong(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* { lat: 48.8566, lng: 2.3522 } → 48.86°N 2.35°E */
export function coords(place) {
  const { lat, lng } = place ?? {};
  if (typeof lat !== 'number' || typeof lng !== 'number') return '';
  const deg = (v, pos, neg) => `${Math.abs(v).toFixed(2)}°${v < 0 ? neg : pos}`;
  return `${deg(lat, 'N', 'S')} ${deg(lng, 'E', 'W')}`;
}

/**
 * @param {{title:string, place:string, date:string, description:string}} post
 * @param {{lat:number, lng:number}} [location]  this place's content/locations.json entry
 */
export function caption(post, location) {
  const c = coords(location);
  const dateline = c
    ? DATELINE.replace('{coords}', c).replace('{date-long}', dateLong(post.date))
    : dateLong(post.date);

  return TEMPLATE.replace('{place}', post.place.toUpperCase())
    .replace('{dateline}', dateline)
    .replace('{title}', post.title)
    .replace('{description}', post.description.trim())
    .trimEnd();
}
