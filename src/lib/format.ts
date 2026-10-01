/**
 * Formattatori numerici consistenti tra SSR (Node.js) e client (browser).
 *
 * PROBLEMA: toLocaleString('it-IT') produce output diverso su Node.js vs browser
 * e causa React hydration error "Text content did not match".
 *
 * SOLUZIONE: implementazione manuale che produce SEMPRE il formato italiano:
 *   separatore migliaia = punto (.)
 *   separatore decimali = virgola (,)
 */

export function formatNumber(
  value: number,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2
): string {
  if (!isFinite(value)) return '0,00';
  const fixed = Math.abs(value).toFixed(maximumFractionDigits);
  const [intPart, decPart] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dec = (decPart || '00').substring(0, Math.max(minimumFractionDigits, maximumFractionDigits)).padEnd(minimumFractionDigits, '0');
  const result = intFormatted + ',' + dec;
  return value < 0 ? '-' + result : result;
}

/** Formatta un valore in euro: 6590 → "6.590,00" */
export function formatEuro(value: number): string {
  return formatNumber(value, 2, 2);
}

/** Formatta una percentuale con 1 decimale: 22.9 → "22,9" */
export function formatPercent(value: number): string {
  return formatNumber(value, 1, 1);
}
