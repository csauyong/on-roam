/* The single source for social captions — used by the issue comment (Phase 2)
   and by the Instagram / Threads posts (Phase 3). Edit freely. */

export const HASHTAGS = '#onroam #filmdiary #travelog';

/* Appended to every caption. {url} is the post's live URL. */
export const FOOTER = `\n\n{url}\n${HASHTAGS}`;

/* "{title} — {place}, {date-long}. {description}" plus the footer. */
export const TEMPLATE = '{title} — {place}, {date-long}. {description}' + FOOTER;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* 13 February 2026 */
export function dateLong(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * @param {{title:string, place:string, date:string, description:string}} post
 * @param {string} url  the post's live URL
 */
export function caption(post, url) {
  return TEMPLATE.replace('{title}', post.title)
    .replace('{place}', titleCase(post.place))
    .replace('{date-long}', dateLong(post.date))
    .replace('{description}', post.description.trim())
    .replace('{url}', url);
}

/* PARIS → Paris, HONG KONG → Hong Kong */
export function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
}
