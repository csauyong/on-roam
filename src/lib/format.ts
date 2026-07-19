export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/* Quartz-datestamp format: '26 2 13 */
export const fmtStamp = (d: Date) =>
  `'${String(d.getUTCFullYear()).slice(2)} ${d.getUTCMonth() + 1} ${d.getUTCDate()}`;

/* MAR 2025 */
export const fmtMY = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

/* 13 FEB 2026 */
export const fmtDMY = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
