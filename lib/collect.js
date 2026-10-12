import Parser from 'rss-parser';
import { RSS_FEEDS, googleNewsQueries } from './sources';
import { query } from './db';
import { fetchGdelt } from './gdelt';

const FEED_TIMEOUT_MS = 10000;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FundingPulse/1.0)' },
  customFields: { item: ['source'] }, // Google News puts the publisher in <source>
});

// Step 2 pre-filter (code, no AI). An amount word alone ("crore", "million")
// also matches results and losses ("Net loss jumps to ₹87 Cr"), so an item
// must contain a funding action word in its title; the snippet is only used
// to confirm it with an amount or funding term.
const ACTION_RE =
  /\b(raises?|raised|raising|funding|seed|pre-seed|pre-series|series [a-f]|round|led by|investment|secures?|bags?|nets|closes)\b/i;
const CONFIRM_RE = /\b(crore|cr|million|mn|billion|bn|lakh|funding|round|investors?|led by|seed|series [a-f])\b|[$₹]/i;

export function looksLikeFunding(item) {
  return ACTION_RE.test(item.title) && CONFIRM_RE.test(`${item.title} ${item.snippet}`);
}

// Google News titles end in " - Publisher"; strip it so the same story from
// two queries/outlets normalises to the same text.
function cleanTitle(title, origin) {
  const t = (title || '').trim();
  return origin === 'google_news' ? t.replace(/\s+-\s+[^-]+$/, '') : t;
}

function normTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s) {
  return new Set(s.split(' ').filter((w) => w.length > 2));
}

function jaccard(a, b) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

async function fetchFeed(source, origin) {
  const started = Date.now();
  try {
    const feed = await parser.parseURL(source.url);
    const items = feed.items.map((it) => {
      const publisher = typeof it.source === 'string' ? it.source : it.source?._ || null;
      return {
        title: cleanTitle(it.title, origin),
        snippet: (it.contentSnippet || '').slice(0, 400),
        url: it.link,
        published: it.isoDate || it.pubDate || null,
        source_name: origin === 'google_news' ? publisher || 'Google News' : source.name,
        origin,
        via: source.name,
      };
    });
    return { status: { name: source.name, url: source.url, origin, ok: true, items: items.length, ms: Date.now() - started }, items };
  } catch (err) {
    return {
      status: { name: source.name, url: source.url, origin, ok: false, items: 0, error: err.message.slice(0, 200), ms: Date.now() - started },
      items: [],
    };
  }
}

// Step 1: collect from fixed RSS, config-driven Google News queries and
// unprocessed manual submissions, then window + dedupe + pre-filter.
// `range` ({ since, until }) is only used when backfilling a past week: then
// RSS (which only holds recent items) and Telegram forwards are skipped and
// Google News is searched for exactly that date range.
export async function collect(config, { now = new Date(), range = null } = {}) {
  const backfill = Boolean(range);
  const gnQueries = googleNewsQueries(config, { range, backfill });
  const feeds = backfill ? [] : RSS_FEEDS;
  const results = await Promise.all([
    ...feeds.map((f) => fetchFeed(f, 'rss')),
    ...gnQueries.map((q) => fetchFeed(q, 'google_news')),
    fetchGdelt(range),
  ]);

  const manualRows = backfill
    ? []
    : await query('SELECT id, text, received_at FROM manual_submissions WHERE processed = false ORDER BY received_at');

  const sourceStatus = results.map((r) => r.status);
  const since = range ? range.since.getTime() : now.getTime() - WINDOW_MS;
  const until = range ? range.until.getTime() : Infinity;
  const inRange = (i) => {
    const t = i.published ? new Date(i.published).getTime() : NaN;
    return t >= since && t < until;
  };

  // Per-source freshness counts, for /api/run?dry=collect and /admin.
  for (const r of results) {
    r.status.fresh = r.items.filter(inRange).length;
  }

  // Window + dedupe (URL, then near-identical title).
  const all = results.flatMap((r) => r.items);
  const inWindow = all.filter((i) => i.url && i.title && inRange(i));
  const seenUrls = new Set();
  const kept = [];
  for (const item of inWindow) {
    const url = item.url.split('?')[0];
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const norm = normTitle(item.title);
    const tok = tokens(norm);
    if (kept.some((k) => k._norm === norm || jaccard(k._tok, tok) >= 0.85)) continue;
    kept.push({ ...item, _norm: norm, _tok: tok });
  }
  const deduped = kept.map(({ _norm, _tok, ...rest }) => rest);
  const funding = deduped.filter(looksLikeFunding);

  // Manual submissions skip the pre-filter: Aarav forwarded them on purpose.
  const manual = manualRows.map((m) => ({
    manual_id: m.id,
    title: m.text.slice(0, 200),
    snippet: m.text.slice(0, 2000),
    url: (m.text.match(/https?:\/\/\S+/) || [null])[0],
    published: m.received_at,
    source_name: 'Telegram forward',
    origin: 'manual',
  }));

  return {
    items: funding,
    manual,
    sourceStatus,
    counts: {
      rss_feeds: feeds.length,
      google_news_queries: gnQueries.length,
      sources_failed: sourceStatus.filter((s) => !s.ok).length,
      rss_failed: sourceStatus.filter((s) => !s.ok && s.origin === 'rss').length,
      gn_failed: sourceStatus.filter((s) => !s.ok && s.origin === 'google_news').length,
      gdelt_ok: sourceStatus.some((s) => s.origin === 'gdelt' && s.ok),
      gdelt_items: sourceStatus.find((s) => s.origin === 'gdelt')?.items || 0,
      raw_items: all.length,
      in_window: inWindow.length,
      after_dedupe: deduped.length,
      after_prefilter: funding.length,
      manual_submissions: manual.length,
    },
  };
}
