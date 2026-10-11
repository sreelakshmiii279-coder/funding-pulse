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
// `when:7d` restricts results to the last 7 days.
function googleNewsUrl(q) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:7d`)}&hl=en-IN&gl=IN&ceid=IN:en`;
}

export function googleNewsQueries(config) {
  const queries = [
    ...config.sectors.map((s) => ({ name: `GN: ${s}`, query: `${s} startup raises funding India` })),
    ...config.watchlist.map((w) => ({ name: `GN: ${w.name}`, query: `"${w.name}" funding` })),
    { name: 'GN: generic Series', query: 'Indian startup raises Series' },
    { name: 'GN: generic seed', query: 'startup seed round India' },
  ];
  return queries.map((q) => ({ ...q, url: googleNewsUrl(q.query) }));
}
