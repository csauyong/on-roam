/* Seed placeholder photos for the three fake trips (Phase 1 only).
   Writes content/posts/<slug>/photo.jpg — real posts will bring real photos. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const posts = [
  // kyoto — sakura pinks over indigo
  { slug: '2025-03-24-kyoto-01', tones: ['#D8A8B8', '#5A5E7B', '#2E3050'], w: 1600, h: 1067 },
  { slug: '2025-03-27-kyoto-02', tones: ['#E3BFC9', '#6C6F8C', '#3A3C60'], w: 1600, h: 1067 },
  { slug: '2025-03-31-kyoto-03', tones: ['#C39BAD', '#4E5270', '#262842'], w: 1600, h: 1067 },
  { slug: '2025-04-04-kyoto-04', tones: ['#CEA3B2', '#565A78', '#2A2C4C'], w: 1600, h: 1200 },
  // lisbon — azulejo blues and warm plaster
  { slug: '2025-06-10-lisbon-01', tones: ['#7FA8C9', '#E8D9A8', '#3E5C76'], w: 1600, h: 1067 },
  { slug: '2025-06-13-lisbon-02', tones: ['#8FB4D2', '#EFE2B8', '#4A688230'], w: 1067, h: 1600 },
  { slug: '2025-06-16-lisbon-03', tones: ['#6F9ABF', '#DFD09E', '#35516B'], w: 1600, h: 1067 },
  // paris — zinc greys
  { slug: '2026-02-13-paris-01', tones: ['#9FA6AD', '#D9CDBB', '#4A4E55'], w: 1600, h: 1067 },
  { slug: '2026-02-14-paris-02', tones: ['#AAB0B6', '#E2D7C6', '#555960'], w: 1600, h: 1200 },
  { slug: '2026-02-15-paris-03', tones: ['#949BA3', '#D1C5B2', '#40444B'], w: 1600, h: 1067 },
  { slug: '2026-02-16-paris-04', tones: ['#A4AAB1', '#DCD1BF', '#4F535A'], w: 1600, h: 1067 },
];

const clean = (t) => (t.length > 7 ? t.slice(0, 7) : t);

for (const p of posts) {
  const dir = path.join('content', 'posts', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  const [a, b, c] = p.tones.map(clean);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0" stop-color="${a}"/>
        <stop offset="0.58" stop-color="${b}"/>
        <stop offset="1" stop-color="${c}"/>
      </linearGradient>
      <radialGradient id="v" cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="0.22"/>
      </radialGradient>
    </defs>
    <rect width="${p.w}" height="${p.h}" fill="url(#g)"/>
    <circle cx="${p.w * 0.72}" cy="${p.h * 0.3}" r="${p.h * 0.16}" fill="${a}" opacity="0.35"/>
    <rect x="${p.w * 0.1}" y="${p.h * 0.62}" width="${p.w * 0.8}" height="${p.h * 0.02}" fill="${c}" opacity="0.3"/>
    <rect width="${p.w}" height="${p.h}" fill="url(#v)"/>
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 84 }).toFile(path.join(dir, 'photo.jpg'));
  console.log('wrote', path.join(dir, 'photo.jpg'));
}
