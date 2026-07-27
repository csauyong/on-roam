/* Download images attached to an issue. The repo is private, so
   github.com/user-attachments URLs need the Actions token; the signed redirect
   they hand back must then be fetched *without* it. */

const EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/gif': '.gif',
};

const MAX_BYTES = 40 * 1024 * 1024;

async function follow(url, token, depth = 0) {
  if (depth > 5) throw new Error(`Too many redirects fetching ${url}`);
  const needsAuth = /^https:\/\/(github\.com|.*\.github\.com|api\.github\.com)\//.test(url);
  const res = await fetch(url, {
    redirect: 'manual',
    headers: {
      'user-agent': 'on-roam-pipeline',
      ...(needsAuth && token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (!loc) throw new Error(`Redirect without Location from ${url}`);
    return follow(new URL(loc, url).toString(), token, depth + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
  return res;
}

/** @returns {Promise<{buffer:Buffer, ext:string}>} */
export async function downloadAttachment(url, token) {
  const res = await follow(url, token);
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = EXT[type] ?? extFromUrl(url);
  if (!ext) throw new Error(`${url} is not an image (content-type: ${type || 'unknown'})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0) throw new Error(`Empty download from ${url}`);
  if (buffer.byteLength > MAX_BYTES) throw new Error(`${url} is larger than ${MAX_BYTES / 1e6}MB`);
  return { buffer, ext };
}

function extFromUrl(url) {
  const m = new URL(url).pathname.toLowerCase().match(/\.(jpe?g|png|webp|heic|gif)$/);
  if (!m) return null;
  return m[0] === '.jpeg' ? '.jpg' : m[0];
}
