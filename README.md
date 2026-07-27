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
optional `type`, and `issue` when the pipeline wrote it). Two post types:

- `"photo"` (default) — place and date sit in the bottom corner of the photo as
  the quartz datestamp; only the title appears beneath it.
- `"reflection"` — long-form caption (blank-line-separated paragraphs in
  `description`, rendered in the serif) with the title centred on the photo
  itself and nothing else on the image.

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

## Publishing

**Posting.** Open a *New post* issue
([.github/ISSUE_TEMPLATE/post.yml](.github/ISSUE_TEMPLATE/post.yml)): place,
date (blank = today), title, description, a cover checkbox, and photos dragged
into the body. [post.yml](.github/workflows/post.yml) then parses it, downloads
the attachments, writes one post folder per photo (the first carries the title
and description), geocodes any new place through Nominatim into
`content/locations.json`, extends or creates the trip in `content/trips.json`,
commits, deploys, comments the live URL and the caption, and closes the issue.
A blank-line-separated description makes it a reflection. A post within
`TRIP_GAP_DAYS` of an existing trip at the same place joins that trip; the
generated trip `name` is a placeholder worth editing by hand.

Posts can arrive in any order. The line is rebuilt from dates on every build, so
a photo backdated by years slots into its true position and the stretch after it
shifts along; `/p/<slug>` URLs are stable through that. The one thing refused is
a genuine conflict — a new trip whose days overlap an existing trip somewhere
else — which fails before anything is written, with both trips named.

Only the repo owner can drive either workflow: `post` checks the issue's author
and `publish` checks who added the label.

**Social.** Add the `publish` label to the closed issue.
[publish.yml](.github/workflows/publish.yml) bakes the datestamp into
`public/social/<slug>.jpg` with sharp (max 1440px long edge, same stamp styling
as the site — reflections get the centred title instead), commits and deploys it
so the image has a public URL, then posts to Instagram and Threads and comments
the permalinks back. Nothing is posted automatically on creation.

Secrets: `IG_USER_ID`, `IG_ACCESS_TOKEN`, `THREADS_USER_ID`,
`THREADS_ACCESS_TOKEN`. Without them the run still builds and deploys the cover
and reports each platform as skipped.

The caption template — `"{title} — {place}, {date-long}. {description}"` plus the
link and hashtag footer — lives in
[caption.config.mjs](caption.config.mjs) and is the single source for both the
issue comment and the posts.

Both scripts run locally:

```bash
ISSUE_BODY="$(cat issue.md)" node scripts/ingest-issue.mjs --dry-run
```

```bash
POST_SLUG=2026-02-13-paris-01 SITE_URL=https://user.github.io node scripts/publish-social.mjs --cover
```
