import { HOME, LAYOUT, MOVED, ORIGIN, WANDER } from '../config';
import { samplePt, tangent } from './arc';
import { initialBearing } from './geo';
import type { ArcTable, Box, SpanOut, Trip } from './types';

/* Build-time geometry: the wander polyline, arc-length table, and the world
   position of every piece of content. Ported from the prototype's
   buildWander() + build(); deterministic so builds are stable. */

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (b: number) => ({ x: Math.sin(b), y: -Math.cos(b) }); // bearing → screen vec, north = up
const DAY = 86400000;
const days = (a: number, b: number) => Math.round((b - a) / DAY);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface TimelineSpan {
  type: 'home' | 'trip' | 'move';
  trip?: Trip;
  d0: number;
  d1: number;
}

function timeline(trips: Trip[], now: number): TimelineSpan[] {
  const spans: TimelineSpan[] = [];
  /* the roam opens with the one-way relocation from ORIGIN to HOME */
  const moved = Date.parse(MOVED);
  spans.push({ type: 'move', d0: moved, d1: moved + DAY });
  let cursor = moved + DAY;
  for (const trip of trips) {
    spans.push({ type: 'home', d0: cursor, d1: Date.parse(trip.start) });
    spans.push({ type: 'trip', trip, d0: Date.parse(trip.start), d1: Date.parse(trip.end) });
    cursor = Date.parse(trip.end);
  }
  spans.push({ type: 'home', d0: cursor, d1: now });
  return spans;
}

export interface KeyframeOut {
  slug: string;
  x: number;
  y: number;
  s: number; // reveal position
  tilt: number;
  photoH: number; // display height at KEYFRAME_W
}
export interface LabelOut {
  x: number;
  y: number;
  s: number; // reveal position
  s0: number; // jump target
  place: string;
  d0: number;
}
export interface DotOut {
  slug: string;
  x: number;
  y: number;
  s: number;
}

export interface World {
  W: number;
  H: number;
  bbox: Box;
  arc: ArcTable;
  spans: SpanOut[];
  origin: { x: number; y: number }; // where the line begins (Hong Kong)
  home: { x: number; y: number }; // where the move lands (London)
  keyframes: KeyframeOut[];
  labels: LabelOut[];
  dots: DotOut[];
  now: { x: number; y: number; s: number };
  tEnd: number;
  postS: Record<string, number>; // slug → arc position (deep-link scroll target)
}

/* deterministic per-slug tilt in [-1.2, 1.2] deg */
function tiltFor(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.round((((h >>> 0) / 4294967295) * 2.4 - 1.2) * 10) / 10;
}

export function buildWorld(
  trips: Trip[],
  photoDims: Record<string, { w: number; h: number }>,
  now = Date.now(),
): World {
  const C = WANDER;
  const spans = timeline(trips, now);

  /* --- the wander: one continuous meander, trips turn to true bearing.
         The pen starts in Hong Kong facing London and arrives into the drift. --- */
  const DRIFT = rad(C.DRIFT_DEG);
  const moveBearing = rad(initialBearing(ORIGIN, HOME));
  let heading = moveBearing;
  let pos = { x: 0, y: 0 };
  const raw: { span: TimelineSpan; pts: { x: number; y: number }[] }[] = [];
  const angDiff = (a: number, b: number) => {
    let d = (b - a) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  for (const sp of spans) {
    const target =
      sp.type === 'trip' ? rad(sp.trip!.bearingDeg) : sp.type === 'move' ? moveBearing : DRIFT;
    const len =
      sp.type === 'trip'
        ? Math.max(days(sp.d0, sp.d1) * C.TRIP_PX_PER_DAY, C.MIN_TRIP_PX)
        : sp.type === 'move'
          ? C.MOVE_PX
          : Math.max(days(sp.d0, sp.d1) * C.HOME_PX_PER_DAY, C.MIN_HOME_PX);
    const n = Math.ceil(len / C.STEP);
    const pts = [{ ...pos }];
    for (let i = 0; i < n; i++) {
      heading +=
        clamp(angDiff(heading, target), -C.TURN, C.TURN) +
        Math.sin((pos.x + pos.y) * C.WOBBLE_FREQ) * C.WOBBLE_AMP; // organic wobble
      pos = { x: pos.x + dir(heading).x * C.STEP, y: pos.y + dir(heading).y * C.STEP };
      pts.push({ ...pos });
    }
    raw.push({ span: sp, pts });
  }

  /* --- normalize into world coords, build paths + arc table --- */
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const r of raw)
    for (const p of r.pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  const PAD = C.PAD;
  const ox = -minX + PAD, oy = -minY + PAD;
  const W = maxX - minX + PAD * 2;
  const H = maxY - minY + PAD * 2;
  const bbox: Box = { x: PAD * 0.35, y: PAD * 0.35, w: W - PAD * 0.7, h: H - PAD * 0.7 };

  const px: number[] = [], py: number[] = [], cum: number[] = [];
  const spansOut: SpanOut[] = [];
  let total = 0;
  let first = true;
  for (const r of raw) {
    const pts = r.pts.map((p) => ({ x: p.x + ox, y: p.y + oy }));
    const s0 = total;
    let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
    if (first) {
      px.push(pts[0]!.x); py.push(pts[0]!.y); cum.push(0);
      first = false;
    }
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
      d += ` L ${pts[i]!.x.toFixed(1)} ${pts[i]!.y.toFixed(1)}`;
      px.push(pts[i]!.x); py.push(pts[i]!.y); cum.push(total);
    }
    spansOut.push({
      type: r.span.type,
      tripId: r.span.trip?.id,
      place: r.span.trip?.place,
      d0: r.span.d0,
      d1: r.span.d1,
      s0,
      s1: total,
      len: total - s0,
      d,
    });
  }
  const arc: ArcTable = { px, py, cum, total };

  /* --- content layout along the line --- */
  const keyframes: KeyframeOut[] = [];
  const labels: LabelOut[] = [];
  const dots: DotOut[] = [];
  const postS: Record<string, number> = {};

  for (let i = 0; i < spansOut.length; i++) {
    const m = spansOut[i]!;
    if (m.type !== 'trip') continue;
    const trip = trips.find((t) => t.id === m.tripId)!;

    const sMid = (m.s0 + m.s1) / 2;
    const mid = samplePt(arc, sMid);
    const tan = tangent(arc, sMid);
    const nx = -tan.y, ny = tan.x; // normal

    const dims = photoDims[trip.cover.slug] ?? { w: 3, h: 2 };
    const photoH = Math.round((LAYOUT.KEYFRAME_W * dims.h) / dims.w);
    const off = LAYOUT.KEYFRAME_GAP + photoH / 2;
    const kx = mid.x + nx * off;
    const ky = mid.y + ny * off;
    keyframes.push({ slug: trip.cover.slug, x: kx, y: ky, s: sMid, tilt: tiltFor(trip.cover.slug), photoH });
    labels.push({ x: kx, y: ky + photoH / 2 + LAYOUT.LABEL_GAP, s: sMid, s0: m.s0, place: trip.place, d0: m.d0 });
    postS[trip.cover.slug] = sMid;

    /* dots for the trip's other posts, positioned by date within the trip */
    const span = Math.max(m.d1 - m.d0, 1);
    for (const post of trip.posts) {
      if (post.slug === trip.cover.slug) continue;
      const frac = clamp((Date.parse(post.date) - m.d0) / span, 0, 1);
      const s = m.s0 + m.len * (LAYOUT.POST_FRAC_MIN + (LAYOUT.POST_FRAC_MAX - LAYOUT.POST_FRAC_MIN) * frac);
      const p = samplePt(arc, s);
      const t = tangent(arc, s);
      dots.push({ slug: post.slug, x: p.x - t.y * LAYOUT.DOT_OFFSET, y: p.y + t.x * LAYOUT.DOT_OFFSET, s });
      postS[post.slug] = s;
    }
  }

  const end = { x: px[px.length - 1]!, y: py[py.length - 1]! };
  const landed = samplePt(arc, spansOut[0]!.s1); // the move ends where London begins

  return {
    W: Math.ceil(W),
    H: Math.ceil(H),
    bbox,
    arc,
    spans: spansOut,
    origin: { x: ox, y: oy },
    home: landed,
    keyframes,
    labels,
    dots,
    now: { x: end.x, y: end.y - 24, s: total - 10 },
    tEnd: now,
    postS,
  };
}
