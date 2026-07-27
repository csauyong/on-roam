/* Parse a GitHub issue-form body (.github/ISSUE_TEMPLATE/post.yml) into fields.
   Issue forms render as "### Label\n\nvalue"; blank optional fields render as
   "_No response_". */

const NO_RESPONSE = '_No response_';

export function parseSections(body) {
  const out = {};
  /* split on level-3 headings, keeping the heading text */
  const parts = String(body ?? '').split(/^###[ \t]+/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n');
    const label = (nl === -1 ? part : part.slice(0, nl)).trim().toLowerCase();
    const value = (nl === -1 ? '' : part.slice(nl + 1)).trim();
    out[label] = value === NO_RESPONSE ? '' : value;
  }
  return out;
}

/* Markdown ![alt](url) and raw <img src="url"> — GitHub renders dropped files
   as either, depending on how they were attached. */
export function extractImageUrls(markdown) {
  const urls = [];
  const push = (u) => {
    if (u && !urls.includes(u)) urls.push(u);
  };
  for (const m of String(markdown ?? '').matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) push(m[1]);
  for (const m of String(markdown ?? '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) push(m[1]);
  return urls;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** @returns {{place:string,date:string,title:string,description:string,cover:boolean,photos:string[]}} */
export function parsePostIssue(body, today = new Date()) {
  const s = parseSections(body);

  const place = (s.place ?? '').trim().toUpperCase();
  if (!place) throw new Error('Missing "Place".');

  const title = (s.title ?? '').trim();
  if (!title) throw new Error('Missing "Title".');

  const description = (s.description ?? '').trim();
  if (!description) throw new Error('Missing "Description".');

  const rawDate = (s.date ?? '').trim();
  const date = rawDate || today.toISOString().slice(0, 10);
  if (!ISO_DATE.test(date)) throw new Error(`"Date" must be YYYY-MM-DD, got "${rawDate}".`);
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error(`"Date" is not a real date: ${date}`);

  /* checkboxes render as "- [x] label" */
  const cover = /- \[[xX]\]/.test(s.cover ?? '');

  const photos = extractImageUrls(s.photos ?? '');
  if (photos.length === 0) throw new Error('No photos found under "Photos" — drag at least one image in.');

  return { place, date, title, description, cover, photos };
}
