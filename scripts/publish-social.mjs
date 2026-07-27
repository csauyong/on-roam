#!/usr/bin/env node
/* Phase 3: post a published post to Instagram and Threads.

   Runs in two passes because both APIs pull the image from a public URL, so the
   social cover has to be deployed to Pages before either is called:

     --cover   bake public/social/<slug>.jpg (commit + deploy happen in between)
     --post    wait for the cover to be live, then post and report permalinks

   Never automatic: the workflow only runs when the `publish` label is added.
   Missing credentials are reported, not thrown.

   env: ISSUE_NUMBER | POST_SLUG, SITE_URL, BASE_PATH,
        IG_USER_ID, IG_ACCESS_TOKEN, THREADS_USER_ID, THREADS_ACCESS_TOKEN */

import fs from 'node:fs';
import path from 'node:path';
import { caption as buildCaption } from '../caption.config.mjs';
import { POSTS, locationsPath, postUrl, readJSON } from './lib/content.mjs';
import { buildSocialCover } from './lib/social-cover.mjs';

const MODE = process.argv.includes('--cover') ? 'cover' : 'post';

/* Instagram has two publishing paths and they differ only in host and token:
     Instagram Login (default) — graph.instagram.com, an Instagram User token,
       permissions instagram_business_basic + instagram_business_content_publish
     Facebook Login — graph.facebook.com, a Facebook Page token, permissions
       instagram_basic + instagram_content_publish + pages_read_engagement
   Set IG_API_BASE to the Facebook host to switch. */
/* `||`, not `??`: an unset Actions variable arrives as an empty string */
const IG_API = process.env.IG_API_BASE || 'https://graph.instagram.com/v21.0';
const TH_API = 'https://graph.threads.net/v1.0';
const THREADS_MAX = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- locating the post ---------- */

function findPost() {
  const issue = process.env.ISSUE_NUMBER ? Number(process.env.ISSUE_NUMBER) : null;
  const wanted = process.env.POST_SLUG;

  const all = fs
    .readdirSync(POSTS)
    .filter((slug) => fs.existsSync(path.join(POSTS, slug, 'meta.json')))
    .map((slug) => ({ slug, meta: readJSON(path.join(POSTS, slug, 'meta.json')) }));

  if (wanted) {
    const hit = all.find((p) => p.slug === wanted);
    if (!hit) throw new Error(`No post folder named "${wanted}".`);
    return hit;
  }

  const mine = all.filter((p) => p.meta.issue === issue);
  if (mine.length === 0)
    throw new Error(
      `No post carries issue #${issue}. Posts written before the pipeline have no issue field — ` +
        `set POST_SLUG to publish one of those.`,
    );
  /* the cover is the one worth posting; otherwise the earliest */
  return mine.find((p) => p.meta.cover) ?? mine.sort((a, b) => a.slug.localeCompare(b.slug))[0];
}

const photoPath = (slug) => {
  const dir = path.join(POSTS, slug);
  const f = fs.readdirSync(dir).find((n) => /^photo\.(jpe?g|png|webp|heic)$/i.test(n));
  if (!f) throw new Error(`No photo file in ${dir}`);
  return path.join(dir, f);
};

function socialUrl(slug) {
  const site = (process.env.SITE_URL || '').replace(/\/+$/, '');
  const base = `${(process.env.BASE_PATH || '/').replace(/\/+$/, '')}/`;
  return `${site}${base}social/${slug}.jpg`;
}

/* ---------- pass 1: bake the cover ---------- */

async function makeCover() {
  const { slug, meta } = findPost();
  const out = path.join(process.cwd(), 'public', 'social', `${slug}.jpg`);
  const { width, height } = await buildSocialCover(photoPath(slug), out, meta);
  return {
    ok: true,
    slug,
    cover: path.relative(process.cwd(), out),
    width,
    height,
    coverUrl: socialUrl(slug),
    url: postUrl(slug, process.env.SITE_URL, process.env.BASE_PATH),
  };
}

/* ---------- pass 2: post ---------- */

async function api(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `${res.status} ${res.statusText} from ${url}`);
  return json;
}

async function get(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `${res.status} ${res.statusText}`);
  return json;
}

/* Pages can lag a moment behind the deploy job. */
async function waitForCover(url, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { method: 'HEAD' }).catch(() => null);
    if (res?.ok) return true;
    await sleep(5000);
  }
  throw new Error(`Social cover never appeared at ${url}`);
}

async function postInstagram(coverUrl, text) {
  const id = process.env.IG_USER_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  if (!id || !token) return { skipped: 'IG_USER_ID / IG_ACCESS_TOKEN not set' };

  const container = await api(`${IG_API}/${id}/media`, {
    image_url: coverUrl,
    caption: text,
    access_token: token,
  });

  /* the container has to finish downloading the image before it can publish */
  for (let i = 0; i < 20; i++) {
    const st = await get(`${IG_API}/${container.id}?fields=status_code&access_token=${token}`);
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR') throw new Error('Instagram could not process the image');
    await sleep(3000);
  }

  const published = await api(`${IG_API}/${id}/media_publish`, {
    creation_id: container.id,
    access_token: token,
  });
  const { permalink } = await get(`${IG_API}/${published.id}?fields=permalink&access_token=${token}`);
  return { id: published.id, permalink };
}

async function postThreads(coverUrl, text) {
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!token) return { skipped: 'THREADS_ACCESS_TOKEN not set' };

  /* Threads never shows a user ID in the app dashboard — it only exists through
     the API, so ask for it. THREADS_USER_ID overrides if you'd rather pin it. */
  const id =
    process.env.THREADS_USER_ID ||
    (await get(`${TH_API}/me?fields=id&access_token=${token}`)).id;
  if (!id) throw new Error('Threads did not return a user id for this token');

  const container = await api(`${TH_API}/${id}/threads`, {
    media_type: 'IMAGE',
    image_url: coverUrl,
    text: text.length > THREADS_MAX ? `${text.slice(0, THREADS_MAX - 1).trimEnd()}…` : text,
    access_token: token,
  });

  /* Threads asks for ~30s between creating and publishing a container */
  await sleep(30000);

  const published = await api(`${TH_API}/${id}/threads_publish`, {
    creation_id: container.id,
    access_token: token,
  });
  const { permalink } = await get(`${TH_API}/${published.id}?fields=permalink&access_token=${token}`);
  return { id: published.id, permalink };
}

async function publish() {
  const { slug, meta } = findPost();
  const url = postUrl(slug, process.env.SITE_URL, process.env.BASE_PATH);
  const coverUrl = socialUrl(slug);
  /* the caption carries no link — `url` is still reported back to the issue */
  const text = buildCaption(meta, readJSON(locationsPath())[meta.place]);

  await waitForCover(coverUrl);

  const [instagram, threads] = await Promise.all([
    postInstagram(coverUrl, text).catch((e) => ({ error: e.message })),
    postThreads(coverUrl, text).catch((e) => ({ error: e.message })),
  ]);

  return { ok: true, slug, url, coverUrl, caption: text, instagram, threads };
}

(MODE === 'cover' ? makeCover() : publish())
  .then((r) => process.stdout.write(`${JSON.stringify(r, null, 2)}\n`))
  .catch((err) => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: err.message }, null, 2)}\n`);
    process.exitCode = 1;
  });
