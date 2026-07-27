/* Phase 3: bake the site's photo treatment into a social cover.

   The site draws the datestamp as a CSS overlay and never touches the original;
   Instagram and Threads need a real pixel, so this writes a *new* file under
   public/social/. The numbers below are the prototype's stamp styling
   (src/styles/archive.css) expressed as ratios of the photo width, so a 1440px
   cover looks like the 560px overlay does on the site.

   Short posts get place + date in the corner; long posts get the title centred
   and nothing else — same rule as the site. */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const MAX_EDGE = 1440;

const STAMP = '#FF6F1E';
const PAPER = '#F6F5F1';

/* A whisper of the site's orange over the whole frame, plus film grain, so a
   cover sitting in a feed reads in the same colour as the archive.

   Two opaque layers, not one translucent one: libvips premultiplies before it
   blends, so a 15%-alpha orange under `soft-light` or `multiply` behaves like
   an almost-black orange and just crushes the picture. Mixing the orange into
   white and into black instead, and compositing those at full alpha, gives the
   real thing — `lift` warms the shadows the way a film print does, `wash`
   pulls the highlights towards the site's paper. Both are fractions of the way
   from black / white to --stamp; past ~0.2 either starts to read as a filter. */
const TINT = { lift: 0.07, wash: 0.12 };

/* Grain is generated at 1/`scale` and scaled up: per-pixel noise is exactly
   what the JPEG encoder throws away, so it has to be coarser than a pixel to
   survive. `sigma` is the spread of the gaussian, `opacity` how much of it
   lands. The noise is unseeded, so rebuilding a cover gives a different file —
   bake each one once. */
const GRAIN = { opacity: 0.1, sigma: 26, scale: 2 };

/* .post .photo .stamp on a 560px-wide photo */
const R = {
  size: 14 / 560,
  right: 14 / 560,
  bottom: 10 / 560,
  glow: 5 / 14, // text-shadow blur, in ems
  skew: -6, // deg
  gap: 0.75, // em between place and date
  track: 0.08, // letter-spacing, em
  placeTrack: 0.2,
  /* .post .photo .ptitle */
  titleSize: 26 / 560,
  titleWidth: 0.7,
  titleLine: 1.35,
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Same quartz format as src/lib/format.ts: '26 2 13 */
export function fmtStamp(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `'${String(d.getUTCFullYear()).slice(2)} ${d.getUTCMonth() + 1} ${d.getUTCDate()}`;
}

/* librsvg has no auto-wrap; break on a monospace-ish width estimate. */
function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if (`${line} ${w}`.length <= maxChars) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function stampSvg(W, H, place, date) {
  const size = W * R.size;
  const x = W - W * R.right;
  /* CSS `bottom` positions the box; SVG `y` is the baseline, so leave the
     descender its room too */
  const y = H - W * R.bottom - size * 0.4;
  const blur = size * R.glow;
  const text =
    `<text x="${x}" y="${y}" text-anchor="end" font-family="DejaVu Sans Mono, Menlo, monospace" ` +
    `font-size="${size.toFixed(1)}" fill="${STAMP}" letter-spacing="${(size * R.track).toFixed(2)}">` +
    `<tspan letter-spacing="${(size * R.placeTrack).toFixed(2)}">${esc(place)}</tspan>` +
    `<tspan dx="${(size * R.gap).toFixed(1)}">${esc(date)}</tspan></text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><filter id="glow" x="-30%" y="-60%" width="160%" height="220%">
    <feGaussianBlur stdDeviation="${(blur / 2).toFixed(2)}"/>
  </filter></defs>
  <g transform="translate(${x} ${y}) skewX(${R.skew}) translate(${-x} ${-y})">
    <g filter="url(#glow)" opacity="0.85">${text}</g>
    ${text}
  </g>
</svg>`;
}

function titleSvg(W, H, rawTitle) {
  /* set lower case, like .ptitle on the site */
  const title = rawTitle.toLowerCase();
  const size = W * R.titleSize;
  const maxChars = Math.max(8, Math.round((W * R.titleWidth) / (size * 0.46)));
  const lines = wrap(title, maxChars);
  const lh = size * R.titleLine;
  const top = H / 2 - ((lines.length - 1) * lh) / 2;
  const tspans = lines
    .map((l, i) => `<tspan x="${W / 2}" y="${(top + i * lh).toFixed(1)}">${esc(l)}</tspan>`)
    .join('');
  const text =
    `<text text-anchor="middle" dominant-baseline="middle" font-family="DejaVu Serif, Georgia, serif" ` +
    `font-style="italic" font-size="${size.toFixed(1)}" fill="${PAPER}">${tspans}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="${(size * 0.12).toFixed(2)}"/>
  </filter></defs>
  <g filter="url(#shadow)" opacity="0.75"><g fill="#14120E">${text.replace(`fill="${PAPER}"`, 'fill="#14120E"')}</g></g>
  ${text}
</svg>`;
}

/* the site's .photo::after vignette (radial darkening) */
function vignetteSvg(W, H) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><radialGradient id="v" cx="50%" cy="45%" r="72%">
    <stop offset="55%" stop-color="#14120E" stop-opacity="0"/>
    <stop offset="100%" stop-color="#14120E" stop-opacity="0.28"/>
  </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#v)"/>
</svg>`;
}

/* `t` of the way from `from` towards --stamp, as a hex colour */
function towardsStamp(from, t) {
  const to = [1, 3, 5].map((i) => parseInt(STAMP.slice(i, i + 2), 16));
  return `#${from.map((c, i) => Math.round(c + (to[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;
}

function fillSvg(W, H, color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${color}"/>
</svg>`;
}

/* Monochrome gaussian noise, ready to composite. */
async function grainPng(W, H) {
  const w = Math.max(1, Math.round(W / GRAIN.scale));
  const h = Math.max(1, Math.round(H / GRAIN.scale));
  return sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
      noise: { type: 'gaussian', mean: 128, sigma: GRAIN.sigma },
    },
  })
    .greyscale()
    .toColourspace('srgb')
    .resize(W, H)
    .ensureAlpha(GRAIN.opacity)
    .png()
    .toBuffer();
}

/**
 * @param {string} src   original photo (never modified)
 * @param {string} out   destination, e.g. public/social/<slug>.jpg
 * @param {{title:string,place:string,date:string,type?:string}} meta
 */
export async function buildSocialCover(src, out, meta) {
  const img = sharp(src, { failOn: 'none' }).rotate(); // honour EXIF orientation
  const { width, height } = await img.metadata();
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);

  const overlay =
    meta.type === 'reflection' ? titleSvg(W, H, meta.title) : stampSvg(W, H, meta.place, fmtStamp(meta.date));

  fs.mkdirSync(path.dirname(out), { recursive: true });
  await img
    .resize(W, H, { fit: 'inside' })
    /* vignette, then colour, then grain, then the type — the stamp stays crisp
       on top rather than sitting under the noise */
    .composite([
      { input: Buffer.from(vignetteSvg(W, H)), blend: 'multiply' },
      { input: Buffer.from(fillSvg(W, H, towardsStamp([0, 0, 0], TINT.lift))), blend: 'screen' },
      { input: Buffer.from(fillSvg(W, H, towardsStamp([255, 255, 255], TINT.wash))), blend: 'multiply' },
      { input: await grainPng(W, H), blend: 'overlay' },
      { input: Buffer.from(overlay) },
    ])
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toFile(out);

  return { out, width: W, height: H };
}
