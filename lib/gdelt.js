// GDELT DOC 2.0 API (free, no key): a searchable index of news from
// thousands of outlets, including regional Indian business sites that the
// fixed RSS list doesn't cover. GDELT allows one request every 5 seconds per
// IP, so each run makes a single request; if GDELT is busy or rate-limits
// us, the run continues and the source is reported as failed, like any feed.

const ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc';
const QUERY = '(raises OR raised OR funding OR "seed round") startup sourcecountry:india';

const gdeltTime = (d) => d.toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '');

// "20261010T123000Z" -> ISO string
function parseSeen(s) {
  const m = String(s || '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

export async function fetchGdelt(range = null) {
  const started = Date.now();
  const params = new URLSearchParams({ query: QUERY, mode: 'artlist', format: 'json', maxrecords: '250', sort: 'datedesc' });
  if (range) {
    params.set('startdatetime', gdeltTime(range.since));
    params.set('enddatetime', gdeltTime(range.until));
  } else {
    params.set('timespan', '7d');
  }
  const status = { name: 'GDELT news index', url: ENDPOINT, origin: 'gdelt' };
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FundingPulse/1.0)' },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!text.trim().startsWith('{')) throw new Error(text.trim().slice(0, 120) || 'empty response');
    const articles = JSON.parse(text).articles || [];
    const items = articles
      .filter((a) => !a.language || /english/i.test(a.language))
      .map((a) => ({
        title: (a.title || '').trim(),
        snippet: '',
        url: a.url,
        published: parseSeen(a.seendate),
        source_name: a.domain || 'GDELT',
        origin: 'gdelt',
        via: 'GDELT',
      }));
    return { status: { ...status, ok: true, items: items.length, ms: Date.now() - started }, items };
  } catch (err) {
    return { status: { ...status, ok: false, items: 0, error: err.message.slice(0, 200), ms: Date.now() - started }, items: [] };
  }
}
