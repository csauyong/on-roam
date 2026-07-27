# on roam

A personal travel blog: a static site with an unusual archive design, fed by a
GitHub-Issues publishing pipeline, with semi-automated posting to Instagram and
Threads.

`on-roam-v2-flower-vs-wander.html` in the repo root is the **design source of
truth** — a working single-file prototype holding the exact aesthetic tokens,
the geometry code, and every interaction. Read it before changing anything
visual. We ship the **wander shape only**: the flower mode and the shape toggle
are deliberately not ported. Treat the prototype as a spec to extract from, not
production code to extend.

## The concept

The archive is one continuous line — the roam — on a large 2D canvas. Scrolling
does not move a page; it moves the visitor along the line (scroll distance = arc
length travelled), and the camera follows. The line meanders at a resting drift
heading while home in London (dotted stroke, time-compressed) and turns toward
the true compass bearing of each journey while travelling (solid stroke,
expanded time). The line opens with the one-way move from Hong Kong to London in
January 2024.

Each trip shows one keyframe cover photo plus small dots for its other posts.
Chrome is minimal: wordmark, one sticky `MAR 2025 · KYOTO` position marker, a
compass rose that rotates with travel heading, a zoomed-out "the roam so far"
overview, and nothing else.

## Stack

- Static site: **Astro + TypeScript, zero UI framework**. The line is vanilla TS
  + SVG ported from the prototype. Deployed to GitHub Pages via Actions.
- Image processing in Node with **sharp**. No client-side image manipulation.
- **No CSS framework.** The prototype's custom properties are ported verbatim:
  `--paper #F6F5F1`, `--ink #201F1B`, `--mute #A29D91`, `--hairline #DCD9CF`,
  `--stamp #FF6F1E`, mono + Georgia-italic type stack.

## Content model

Repo-committed content, one folder per post:

```
content/posts/2026-02-13-paris-01/
  photo.jpg          # original, untouched
  meta.json          # { title, place, date, description, cover, tripId, type? }
content/trips.json   # [{ id, place, name, start, end }]
content/locations.json  # geocode cache: { "PARIS": { lat, lng } }
```

`type` is `"photo"` (default) or `"reflection"` (long-form).

Derived at build time, **never hand-edited**: initial great-circle bearing from
home base to each location, the wander polyline, per-post arc positions.

### Photo treatment

- **Short posts** (`"photo"`): place + date as the quartz datestamp in the
  bottom corner of the photo; only the title appears under it.
- **Long posts** (`"reflection"`): the title alone, centred on the photo —
  no datestamp, nothing else on the image.

The datestamp on the site is always an HTML/CSS overlay (`.stamp`), never baked
into the archive images. It is baked in only for Phase 3 social covers.

## Phases

1. **The site** — done. The archive rendered from local content: camera-follow
   rAF loop, segment draw-on-scroll, reveal logic, sticky marker, compass, hint,
   overview zoom, dot hover-preview (fine pointers only), post overlay, real
   `/p/<slug>` URLs, plain fallback index at `/index/` doubling as the
   reduced-motion experience.
2. **The pipeline** — GitHub Issues → content. Issue form, an action on
   `issues: opened` that parses it, downloads attached images, creates post
   folders, geocodes new places via Nominatim, commits, comments back with the
   live URL and generated caption, and closes the issue.
3. **Social posting** — triggered by adding a `publish` label to the closed post
   issue, never automatic. Bakes the datestamp into a social cover with sharp,
   posts via the Instagram Graph API and the Threads API, comments the resulting
   URLs back on the issue.

## Guardrails

- **Never modify or overwrite original photos.** All processing writes new files.
- Commit generated files only under `content/` and `public/social/`.
- Keep total JS on the archive page small. No analytics, no third-party fonts,
  no cookie anything.
- Accessibility: everything clickable is a real `<button>`/`<a>` with focus
  styles; the overlay is Esc-closable; reduced motion gets the static fallback
  plus a non-animated, pannable overview.
- **Ask before adding any dependency** beyond Astro, sharp, and octokit.
- All tunables (home base, origin, drift heading, px/day time compression,
  minimum segment lengths, turn rate, layout offsets) live in
  [src/config.ts](src/config.ts). The caption template lives in
  [caption.config.mjs](caption.config.mjs). Nothing tunable belongs anywhere else.

## Testing note

The in-app browser pane suspends rAF and scroll events between tool calls, and
its screenshots intermittently come back blank. A frozen camera is not a bug.
Verify with real interactions and DOM measurement, not injected `scrollTo`.
