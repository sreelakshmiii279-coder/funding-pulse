import { generateJson } from './gemini';
import { INR_PER_USD } from './extract';

// Step 5: brief writer. Gemini writes the prose (summary, why each alert
// matters, patterns); code renders every deal line and link, so the model
// cannot add a deal, amount, investor or URL that is not in the data.

const TREND_WORDS = /\b(accelerat\w*|cool\w*|trend\w*|momentum|surg\w*|slow\w*|heat\w* up|picking up)\b/i;

const SYSTEM = `You write the prose parts of a weekly Indian startup funding brief for Aarav, a venture scout at a Bengaluru family office.
Rules:
- Use ONLY the deals and numbers provided. Never invent a deal, amount, investor, company or trend.
- Every pattern bullet MUST cite counts from the stats, e.g. "6 fintech deals this week (4 disclosed, $31.5M total)".
- If trend_allowed is false, describe only this week's distribution. Do NOT use words like accelerating, cooling, trend, momentum, surge, slowing.
- If trend_allowed is true, you may compare a sector to sector_4wk_avg, citing both numbers.
- Plain, direct tone for a busy investor. No hype, no exclamation marks, no adjectives like "massive" or "impressive".
- Notes are one short sentence each and refer to deals by deal_id.`;

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two sentences: the week in numbers and the single most relevant item for Aarav.' },
    watchlist_notes: {
      type: 'array',
      items: { type: 'object', properties: { deal_id: { type: 'integer' }, note: { type: 'string' } }, required: ['deal_id', 'note'] },
    },
    adjacency_notes: {
      type: 'array',
      items: { type: 'object', properties: { deal_id: { type: 'integer' }, note: { type: 'string' } }, required: ['deal_id', 'note'] },
    },
    patterns: { type: 'array', items: { type: 'string' }, description: '3 to 5 bullets, each citing counts.' },
  },
  required: ['summary', 'watchlist_notes', 'adjacency_notes', 'patterns'],
};

const md = (s) => String(s ?? '').replace(/([\[\]*_`|])/g, '\\$1');

function link(d) {
  if (d.source_url.startsWith('telegram:')) return 'forwarded via Telegram';
  return `[${md(d.source_name || 'source')}](${d.source_url})`;
}

function dealLine(d) {
  const parts = [
    `**${md(d.company)}**`,
    md(d.amount_text || 'amount undisclosed'),
    md(d.stage || 'stage undisclosed'),
    md(d.sector || 'sector n/a'),
    d.lead_investor ? `led by ${md(d.lead_investor)}` : 'lead investor n/a',
    link(d),
  ];
  return `- ${parts.join(' · ')}${d.origin === 'manual' ? ' *(manual)*' : ''}`;
}

function shortLine(d) {
  return `- ${md(d.company)} · ${md(d.amount_text || 'undisclosed')} · ${md(d.stage)} · ${md(d.sector || 'n/a')} · ${link(d)}`;
}

export function coverageFooter(counts) {
  return (
    `Scanned ${counts.rss_feeds} feeds (${counts.rss_failed} failed), ` +
    `${counts.google_news_queries} Google News queries (${counts.gn_failed} failed), ` +
    `${counts.manual_submissions} manual submissions. ` +
    'LinkedIn and X are not monitored automatically; forward posts to the Telegram bot to include them.'
  );
}

export async function writeBrief({ weekStart, ranked, watch, adjacency, stats, config, counts }) {
  const byId = new Map(ranked.map((d) => [d.id, d]));
  const compact = ranked.map((d) => ({
    deal_id: d.id, company: d.company, amount_text: d.amount_text, amount_usd_m: d.amount_usd_m,
    stage: d.stage, sector: d.sector, lead_investor: d.lead_investor, tier: d.tier, headline: d.headline,
  }));

  let ai = { summary: '', watchlist_notes: [], adjacency_notes: [], patterns: [] };
  if (ranked.length) {
    ai = await generateJson({
      system: SYSTEM,
      temperature: 0.2,
      schema: SCHEMA,
      prompt: JSON.stringify({
        week_of: weekStart,
        config: { sectors: config.sectors, stages: config.stages },
        watchlist_matches: watch,
        portfolio_adjacencies: adjacency,
        stats,
        deals: compact,
      }),
    });
  }

  // Guard rails on the model's output (check 06).
  const patterns = (ai.patterns || [])
    .filter((p) => /\d/.test(p)) // every pattern must cite a count
    .filter((p) => stats.trend_allowed || !TREND_WORDS.test(p))
    .slice(0, 5);
  const noteFor = (list, id) => list.find((n) => n.deal_id === id)?.note;

  const focus = ranked.filter((d) => d.tier === 1);
  const sectorOnly = ranked.filter((d) => d.tier === 2);
  const other = ranked.filter((d) => d.tier === 3);

  const out = [];
  out.push(`# Funding Pulse · week of ${weekStart}`, '');
  if (ai.summary) out.push(ai.summary, '');

  out.push('## Watchlist alerts', '');
  if (!watch.length) out.push('None this week.');
  for (const w of watch) {
    const d = byId.get(w.deal_id);
    out.push(`${dealLine(d)}`, `  - Watchlist: **${md(w.watch)}** (matched "${md(w.matched_on)}"). ${md(noteFor(ai.watchlist_notes, d.id) || '')}`);
  }
  out.push('');

  out.push('## Possible portfolio adjacencies', '');
  if (!adjacency.length) out.push('None this week.');
  for (const a of adjacency) {
    const d = byId.get(a.deal_id);
    out.push(
      dealLine(d),
      `  - Possible adjacency to **${md(a.portfolio)}**: same sector (${md(a.sector)}) and mentions "${md(a.keyword)}". ${md(noteFor(ai.adjacency_notes, d.id) || '')}`
    );
  }
  out.push('');

  out.push('## Focus deals', '');
  out.push(`*Your sectors and stages (${focus.length})*`, '');
  out.push(...(focus.length ? focus.map(dealLine) : ['None this week.']), '');
  if (sectorOnly.length) out.push(`*Your sectors, other stages (${sectorOnly.length})*`, '', ...sectorOnly.map(dealLine), '');

  out.push('## Patterns this week', '');
  out.push(...(patterns.length ? patterns.map((p) => `- ${p}`) : ['- Not enough deals this week to describe patterns.']));
  if (!stats.trend_allowed) {
    out.push('', `*Week-over-week comparisons start once 3 prior weeks of history exist (currently ${stats.prior_weeks}).*`);
  }
  out.push('');

  out.push(`## Other notable deals (${other.length})`, '');
  out.push(...(other.length ? other.map(shortLine) : ['None this week.']), '');

  out.push('---', '');
  out.push(
    `${stats.total_deals} deals, ${stats.disclosed_deals} with disclosed amounts totalling ~$${stats.total_disclosed_usd_m}M ` +
      `(INR converted at ${INR_PER_USD}/USD).`,
    '',
    `*${coverageFooter(counts)}*`
  );

  return out.join('\n');
}
