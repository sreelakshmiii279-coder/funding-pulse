// Fixed RSS feeds. Each URL was checked on 2026-10-11 and returned valid RSS
// with items from the last 7 days.
//
// Dropped after checking:
//   VCCircle (/rss, /feed, /feeds/rss)   -> HTTP 500 or malformed XML
//   Moneycontrol (startup.xml, business.xml, technology.xml) -> HTTP 503 or no items in 7 days
//   Hindu BusinessLine startups          -> timed out / socket hang up
//   Business Standard start-ups feed     -> malformed XML (the companies feed below works)
//   Inc42 funding-galore feed            -> valid but empty
//   Entrackr /feed/                      -> 404 (the /rss URL below works)
export const RSS_FEEDS = [
  { name: 'Inc42', url: 'https://inc42.com/feed/' },
  { name: 'Inc42 Buzz', url: 'https://inc42.com/buzz/feed/' },
  { name: 'Entrackr', url: 'https://entrackr.com/rss' },
  { name: 'YourStory', url: 'https://yourstory.com/feed' },
  { name: 'YourStory Funding', url: 'https://yourstory.com/category/funding/feed' },
  { name: 'ET Startups', url: 'https://economictimes.indiatimes.com/tech/startups/rssfeeds/78570540.cms' },
  { name: 'ET Funding', url: 'https://economictimes.indiatimes.com/tech/funding/rssfeeds/78570550.cms' },
  { name: 'ET Tech', url: 'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms' },
  { name: 'Livemint Companies', url: 'https://www.livemint.com/rss/companies' },
  { name: 'Business Standard Companies', url: 'https://www.business-standard.com/rss/companies-101.rss' },
  { name: 'TechCrunch India', url: 'https://techcrunch.com/tag/india/feed/' },
  { name: 'StartupTalky', url: 'https://startuptalky.com/rss/' },
];

// Google News returns nothing when the whole query is wrapped in quotes, so
// queries are plain keywords; only company names are quoted (exact match).
// Live runs use `when:7d`; backfill runs use an exact `after:/before:` range.
const ymd = (d) => d.toISOString().slice(0, 10);

function googleNewsUrl(q, range) {
  const time = range ? `after:${ymd(range.since)} before:${ymd(range.until)}` : 'when:7d';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} ${time}`)}&hl=en-IN&gl=IN&ceid=IN:en`;
}

// Press releases and financial newswires (the assignment names both). The
// newswires' own India RSS feeds return 404, so they are reached through
// Google News, restricted to the wire sites.
const NEWSWIRE_QUERIES = [
  { name: 'GN: newswires', query: 'India startup raises funding site:prnewswire.com OR site:businesswire.com OR site:globenewswire.com' },
  { name: 'GN: press releases', query: 'Indian startup raises funding "press release"' },
];

// Backfilling past weeks: the fixed RSS feeds only hold their latest items,
// so the same outlets are searched through Google News for the date range.
const OUTLET_QUERIES = [
  'entrackr.com', 'inc42.com', 'yourstory.com', 'economictimes.indiatimes.com',
  'vccircle.com', 'moneycontrol.com', 'livemint.com', 'business-standard.com',
].map((site) => ({ name: `GN: ${site}`, query: `raises funding site:${site}` }));

export function googleNewsQueries(config, { range = null, backfill = false } = {}) {
  const queries = [
    ...config.sectors.map((s) => ({ name: `GN: ${s}`, query: `${s} startup raises funding India` })),
    ...config.watchlist.map((w) => ({ name: `GN: ${w.name}`, query: `"${w.name}" funding` })),
    { name: 'GN: generic Series', query: 'Indian startup raises Series' },
    { name: 'GN: generic seed', query: 'startup seed round India' },
    ...NEWSWIRE_QUERIES,
    ...(backfill ? OUTLET_QUERIES : []),
  ];
  return queries.map((q) => ({ ...q, url: googleNewsUrl(q.query, range) }));
}
