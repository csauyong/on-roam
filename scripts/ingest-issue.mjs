#!/usr/bin/env node
/* Phase 2: GitHub issue → content/.
   Parses the post issue form, downloads its attached photos, writes one post
   folder per photo, geocodes any new place, and updates trips.json.
   Prints a JSON result on stdout for the workflow to comment back with.

   env: ISSUE_BODY, GITHUB_TOKEN, SITE_URL, BASE_PATH
   flags: --dry-run (parse and report, write nothing) */

import { caption } from '../caption.config.mjs';
import { downloadAttachment } from './lib/attachments.mjs';
import { geocodePlace } from './lib/geocode.mjs';
import { parsePostIssue } from './lib/issue-form.mjs';
import {
  allocateSlug,
  assertNoOverlap,
  assignTrip,
  homeName,
  locationsPath,
  postType,
  postUrl,
  readJSON,
  tripHasCover,
  tripsPath,
  writeJSON,
  writePost,
} from './lib/content.mjs';

const DRY = process.argv.includes('--dry-run');

async function main() {
  const form = parsePostIssue(process.env.ISSUE_BODY);
  const issueNumber = process.env.ISSUE_NUMBER ? Number(process.env.ISSUE_NUMBER) : null;

  if (form.place === homeName())
    throw new Error(
      `"${form.place}" is home — the line only lays photos along trips. ` +
        `Post it under the place you were actually shooting.`,
    );

  /* --- geocode the place once, then cache --- */
  const locations = readJSON(locationsPath());
  let geocoded = null;
  if (!locations[form.place]) {
    geocoded = await geocodePlace(form.place);
    locations[form.place] = geocoded;
  }

  /* --- trip assignment --- */
  const trips = readJSON(tripsPath());
  const trip = assignTrip(trips, form.place, form.date);
  assertNoOverlap(trips);

  /* --- photos: first is the post, extras become their own posts.
         Every download has to succeed before anything is written, or a failure
         halfway through would commit a post pointing at an unwritten trip. --- */
  const photos = [];
  for (const url of form.photos) photos.push(await downloadAttachment(url, process.env.GITHUB_TOKEN));

  const type = postType(form.description);
  const taken = new Set();
  const planned = [];
  let coverClaimed = tripHasCover(trip.id);

  for (const [i, photo] of photos.entries()) {
    const slug = allocateSlug(form.date, form.place, taken);
    taken.add(slug);

    /* only the first photo carries the title and description; the rest are
       companion frames from the same day */
    const first = i === 0;
    const cover = first && (form.cover || !coverClaimed);
    if (cover) coverClaimed = true;

    const meta = {
      title: first ? form.title : `${form.title} (${i + 1})`,
      place: form.place,
      date: form.date,
      description: first ? form.description : '',
      cover,
      tripId: trip.id,
      ...(first && type === 'reflection' ? { type } : {}),
      /* provenance: Phase 3 uses this to find what the `publish` label means */
      ...(issueNumber ? { issue: issueNumber } : {}),
    };

    planned.push({ slug, cover, bytes: photo.buffer.byteLength, meta, photo });
  }

  const written = planned.map(({ photo, ...rest }) => rest);

  if (!DRY) {
    writeJSON(locationsPath(), sortKeys(locations));
    writeJSON(tripsPath(), trips);
    for (const p of planned) writePost(p.slug, p.meta, p.photo);
  }

  const first = written[0];
  const url = postUrl(first.slug, process.env.SITE_URL, process.env.BASE_PATH);
  const result = {
    ok: true,
    trip: { id: trip.id, place: trip.place, start: trip.start, end: trip.end },
    geocoded,
    posts: written.map((w) => ({ slug: w.slug, cover: w.cover })),
    url,
    caption: caption({ ...first.meta, description: form.description }, url),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ ok: false, error: err.message }, null, 2)}\n`);
  process.exitCode = 1;
});
