import type { ImageMetadata } from 'astro';

/* Every post photo, imported through Vite so Astro's sharp-backed image
   service can derive web sizes at build time. Originals are never touched. */

const mods = import.meta.glob<ImageMetadata>('/content/posts/*/photo.{jpg,jpeg,png}', {
  eager: true,
  import: 'default',
});

export const photoMeta: Record<string, ImageMetadata> = {};
for (const [p, meta] of Object.entries(mods)) {
  const slug = p.split('/')[3]!;
  photoMeta[slug] = meta;
}

export const photoDims: Record<string, { w: number; h: number }> = Object.fromEntries(
  Object.entries(photoMeta).map(([slug, m]) => [slug, { w: m.width, h: m.height }]),
);
