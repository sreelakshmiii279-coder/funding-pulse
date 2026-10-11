const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-05" -> "5–11 Oct 2026" (the Mon–Sun week the brief covers).
export function weekRange(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start.getTime() + 6 * 864e5);
  const s = `${start.getUTCDate()}${start.getUTCMonth() !== end.getUTCMonth() ? ` ${MONTHS[start.getUTCMonth()]}` : ''}`;
  return `${s}–${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

export function usd(m) {
  if (m == null || Number.isNaN(Number(m))) return null;
  const n = Number(m);
  if (n >= 1000) return `$${(n / 1000).toFixed(2)}B`;
  if (n >= 1) return `$${n.toFixed(n >= 100 ? 0 : 1)}M`;
  return `$${Math.round(n * 1000)}K`;
}

export function istDateTime(d) {
  return new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export const isLink = (url) => /^https?:\/\//.test(url || '');
