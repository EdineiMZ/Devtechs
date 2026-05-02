/**
 * Deterministic date formatters that produce the same output on Node.js
 * (server-side rendering) and the browser, avoiding React hydration mismatches.
 *
 * `toLocaleDateString('pt-BR')` can yield different results depending on
 * the ICU data bundled in the runtime. These helpers format explicitly.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Returns "DD/MM/YYYY".
 * Accepts any value accepted by `new Date()` (ISO string, timestamp, etc.).
 */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Returns "DD/MM/YYYY HH:MM".
 */
export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
