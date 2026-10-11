import { query } from './db';

// Step 4: matching, stats and ranking. All in code; no AI.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (s) => new RegExp(`(^|[^a-z0-9])${esc(s.toLowerCase())}($|[^a-z0-9])`, 'i');
const lc = (s) => (s || '').toLowerCase().trim();

// Watchlist: exact name/alias match (case-insensitive, whole words) against
// the company name and the headline.
export function watchlistMatches(deals, watchlist) {
  const out = [];
  for (const w of watchlist) {
    const names = [w.name, ...(w.aliases || [])].filter(Boolean);
    for (const d of deals) {
      const hit = names.find((n) => wordRe(n).test(d.company) || wordRe(n).test(d.headline || ''));
      if (hit) out.push({ deal_id: d.id, watch: w.name, matched_on: hit });
    }
  }
  return out;
}

// Possible portfolio adjacency: same sector AND a portfolio keyword appears
// in the headline or company name. Always labelled "possible".
export function adjacencyMatches(deals, portfolio) {
  const out = [];
  for (const p of portfolio) {
    for (const d of deals) {
      if (!d.sector || lc(d.sector) !== lc(p.sector)) continue;
      if (lc(d.company) === lc(p.name)) continue;
      const kw = (p.keywords || []).find((k) => wordRe(k).test(`${d.company} ${d.headline || ''}`));
      if (kw) out.push({ deal_id: d.id, portfolio: p.name, sector: p.sector, keyword: kw });
    }
  }
  return out;
}

// Focus ranking: tier 1 = config sector AND stage, tier 2 = sector only,
// tier 3 = everything else. Within a tier, larger disclosed USD first.
export function rankDeals(deals, config) {
  const sectors = new Set(config.sectors.map(lc));
  const stages = new Set(config.stages.map(lc));
  return deals
    .map((d) => {
      const sec = sectors.has(lc(d.sector));
      const stg = stages.has(lc(d.stage));
      return { ...d, tier: sec && stg ? 1 : sec ? 2 : 3 };
    })
    .sort((a, b) => a.tier - b.tier || (Number(b.amount_usd_m) || -1) - (Number(a.amount_usd_m) || -1));
}

function groupStats(deals, field) {
  const map = {};
  for (const d of deals) {
    const k = d[field] || 'unknown';
    map[k] ||= { deals: 0, disclosed_deals: 0, total_usd_m: 0 };
    map[k].deals++;
    if (d.amount_usd_m != null) {
      map[k].disclosed_deals++;
      map[k].total_usd_m = Math.round((map[k].total_usd_m + Number(d.amount_usd_m)) * 100) / 100;
    }
  }
  return Object.entries(map)
    .map(([key, v]) => ({ [field]: key, ...v }))
    .sort((a, b) => b.deals - a.deals);
}

// This week's distribution, plus a 4-week sector baseline once at least
// 3 prior weeks of history exist (check 05: no trend claims before that).
export async function computeStats(deals, weekStart) {
  const [{ prior_weeks }] = await query(
    'SELECT count(DISTINCT week_start)::int AS prior_weeks FROM deals WHERE week_start < $1',
    [weekStart]
  );
  const bySector = groupStats(deals, 'sector');
  const byStage = groupStats(deals, 'stage');
  const disclosed = deals.filter((d) => d.amount_usd_m != null);

  let sectorBaseline = null;
  if (prior_weeks >= 3) {
    const rows = await query(
      `WITH weeks AS (
         SELECT DISTINCT week_start FROM deals WHERE week_start < $1 ORDER BY week_start DESC LIMIT 4
       )
       SELECT d.sector, count(*)::float / (SELECT count(*) FROM weeks) AS avg_deals_per_week
       FROM deals d JOIN weeks w ON d.week_start = w.week_start
       GROUP BY d.sector`,
      [weekStart]
    );
    sectorBaseline = Object.fromEntries(
      rows.map((r) => [r.sector || 'unknown', Math.round(r.avg_deals_per_week * 10) / 10])
    );
  }

  return {
    total_deals: deals.length,
    disclosed_deals: disclosed.length,
    total_disclosed_usd_m: Math.round(disclosed.reduce((s, d) => s + Number(d.amount_usd_m), 0) * 100) / 100,
    by_sector: bySector,
    by_stage: byStage,
    prior_weeks,
    trend_allowed: prior_weeks >= 3,
    sector_4wk_avg: sectorBaseline,
  };
}
