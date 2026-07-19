# on roam

A travel log drawn as one continuous line. The line begins in Hong Kong and
opens with the one-way move to London (January 2024, solid stroke at the true
bearing of the journey). From there, dotted stretches are time at home in
London, solid stretches are trips, turned toward the true compass bearing of
each journey. Scrolling moves you along the roam; the camera follows.

## Develop

```sh
npm install
npm run seed   # regenerate placeholder photos for the 3 fake trips (Phase 1 only)
npm run dev
```

- `/` — the archive (the line)
- `/p/<slug>/` — a post: the archive scrolled to its position with the overlay open
- `/index/` — plain reverse-chronological list; also the reduced-motion / no-JS experience

## Content

One folder per post under `content/posts/<slug>/` with an untouched `photo.jpg`
and a `meta.json` (`title`, `place`, `date`, `description`, `cover`, `tripId`,
optional `type`). Two post types:

- `"photo"` (default) — the photo with its datestamp and a short description.
- `"reflection"` — long-form caption (blank-line-separated paragraphs in
  `description`, rendered in the serif) with the short title set on the photo
  itself rather than under it.

Trips live in `content/trips.json`, geocodes in `content/locations.json`.
The Hong Kong → London move (origin, home base, moving day) is configured in
`src/config.ts`.
Bearings, the wander polyline, and per-post arc positions are derived at build
time — never hand-edited.

## Tuning

Everything tunable — home base, drift heading, px/day time compression, minimum
segment lengths, turn rate, layout offsets — lives in [src/config.ts](src/config.ts).

## Deploy

GitHub Pages via [.github/workflows/deploy.yml](.github/workflows/deploy.yml).
For a project page set repo variables `SITE_URL` (e.g. `https://user.github.io`)
and `BASE_PATH` (e.g. `/on-roam`); a user/custom-domain site needs neither.
