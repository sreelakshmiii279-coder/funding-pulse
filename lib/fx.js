// Live INR/USD rate from Frankfurter (free, no key; European Central Bank
// reference rates, published on working days). Each week's deals are
// converted at the rate on that week's last day (or the latest published
// rate before it), so a ₹ amount always becomes the same $ figure.

export const FALLBACK_INR_PER_USD = 88;
const cache = new Map();

export async function inrPerUsd(dateYmd) {
  const today = new Date().toISOString().slice(0, 10);
  const day = !dateYmd || dateYmd > today ? 'latest' : dateYmd;
  if (cache.has(day)) return cache.get(day);
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/${day}?base=USD&symbols=INR`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const rate = Number(j.rates?.INR);
    if (!rate) throw new Error('no INR rate in response');
    const out = { rate, date: j.date, source: 'Frankfurter (ECB reference rate)' };
    cache.set(day, out);
    return out;
  } catch (err) {
    console.warn('[fx] falling back to fixed rate:', err.message);
    return { rate: FALLBACK_INR_PER_USD, date: null, source: `fixed fallback (${err.message})` };
  }
}

// "Rs 40 Cr" / "₹142 Cr" / "INR 5 crore" / "Rs 50 lakh" -> USD millions.
export function inrToUsdM(text, rate) {
  const m = String(text || '').replace(/,/g, '').match(/(?:rs\.?|inr|₹)\s*([\d.]+)\s*(cr|crore|lakh|lac|mn|million|bn|billion)?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] || '').toLowerCase();
  const inr =
    unit.startsWith('cr') ? n * 1e7 :
    unit.startsWith('la') ? n * 1e5 :
    unit.startsWith('m') ? n * 1e6 :
    unit.startsWith('b') ? n * 1e9 : null;
  return inr ? Math.round((inr / rate / 1e6) * 100) / 100 : null;
}

export const isInrAmount = (text) => /(?:rs\.?|inr|₹)\s*[\d.,]+/i.test(String(text || ''));
