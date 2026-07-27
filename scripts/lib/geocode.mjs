/* Nominatim geocoding, used once per new place and then cached in
   content/locations.json. Their usage policy requires an identifying
   User-Agent and at most one request per second — we honour both. */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const UA = 'on-roam/1.0 (+https://github.com/csauyong/on-roam; travel blog build pipeline)';

let lastCall = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rateLimit() {
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}

/** @returns {Promise<{lat:number,lng:number}>} */
export async function geocodePlace(place) {
  await rateLimit();
  const url = `${ENDPOINT}?${new URLSearchParams({ q: place, format: 'jsonv2', limit: '1' })}`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status} ${res.statusText} for "${place}"`);

  const hits = await res.json();
  if (!Array.isArray(hits) || hits.length === 0)
    throw new Error(`Nominatim found nothing for "${place}" — add it to content/locations.json by hand.`);

  const { lat, lon } = hits[0];
  return { lat: round(Number(lat)), lng: round(Number(lon)) };
}

const round = (v) => Math.round(v * 1e4) / 1e4;
