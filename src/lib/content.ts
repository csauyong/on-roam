import fs from 'node:fs';
import path from 'node:path';
import { HOME } from '../config';
import { initialBearing } from './geo';
import type { LatLng, Post, PostMeta, Trip, TripMeta } from './types';

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'content');

export interface Content {
  trips: Trip[]; // sorted by start asc
  posts: Post[]; // sorted by date asc
  locations: Record<string, LatLng>;
}

export function loadContent(): Content {
  const trips: TripMeta[] = JSON.parse(fs.readFileSync(path.join(CONTENT, 'trips.json'), 'utf8'));
  const locations: Record<string, LatLng> = JSON.parse(
    fs.readFileSync(path.join(CONTENT, 'locations.json'), 'utf8'),
  );

  const postsDir = path.join(CONTENT, 'posts');
  const posts: Post[] = fs
    .readdirSync(postsDir)
    .filter((f) => fs.existsSync(path.join(postsDir, f, 'meta.json')))
    .map((slug) => {
      const meta: PostMeta = JSON.parse(fs.readFileSync(path.join(postsDir, slug, 'meta.json'), 'utf8'));
      return { ...meta, slug };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));

  const byTrip = new Map<string, Post[]>();
  for (const p of posts) {
    if (!byTrip.has(p.tripId)) byTrip.set(p.tripId, []);
    byTrip.get(p.tripId)!.push(p);
  }

  const full: Trip[] = trips
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((t) => {
      const loc = locations[t.place];
      if (!loc) throw new Error(`No location for "${t.place}" in content/locations.json`);
      const tripPosts = byTrip.get(t.id) ?? [];
      if (tripPosts.length === 0) throw new Error(`Trip "${t.id}" has no posts`);
      const cover = tripPosts.find((p) => p.cover) ?? tripPosts[0]!;
      return { ...t, bearingDeg: initialBearing(HOME, loc), posts: tripPosts, cover };
    });

  for (let i = 1; i < full.length; i++) {
    if (full[i]!.start < full[i - 1]!.end)
      throw new Error(`Trips overlap: ${full[i - 1]!.id} / ${full[i]!.id}`);
  }

  return { trips: full, posts, locations };
}
