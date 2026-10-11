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
- If trend_allowed is true, use stats.sector_trends (direction is computed in code). Call a sector accelerating / above its average ONLY if its direction is "up", and cooling / below its average ONLY if "down"; cite this week's count and the average. The average covers stats.overall_4wk_avg.weeks earlier weeks: call it an "N-week average" with that N. Sectors marked portfolio:true are ones Aarav's portfolio touches: mention their direction even when "steady".
- When investor_activity is present, include one pattern about investors (the most active investor, or an investor new to one of Aarav's sectors), citing counts. "New" means first time in our stored history, not first time ever.
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

export async function writeBrief({ weekStart, ranked, watch, adjacency, stats, config, counts, investors }) {
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
        investor_activity: investors
          ? { most_active: investors.most_active, new_in_focus: investors.new_in_focus?.slice(0, 10) ?? 'not enough history yet' }
          : null,
        deals: compact,
      }),
    });
  }

  // Guard rails on the model's output (check 06).
  const patterns = (ai.patterns || [])
    .filter((p) => /\d/.test(p)) // every pattern must cite a count
    // Trend words only for sectors the code labelled up/down.
    .filter((p) => {
      if (!TREND_WORDS.test(p)) return true;
      if (!stats.trend_allowed) return false;
      return (stats.sector_trends || []).some((t) => t.direction !== 'steady' && p.toLowerCase().includes(t.sector.toLowerCase()));
    })
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

  if (stats.sector_trends) {
    const arrow = { up: '▲ above average', down: '▼ below average', steady: '— in line' };
    out.push(`## Your sectors vs ${stats.overall_4wk_avg?.weeks || 4}-week average`, '');
    for (const t of stats.sector_trends) {
      out.push(`- **${md(t.sector)}**${t.portfolio ? ' (portfolio)' : ''}: ${t.this_week} this week vs ${t.avg_4wk} avg · ${arrow[t.direction]}`);
    }
    out.push('');
  }

  if (investors) {
    out.push('## Investor activity', '');
    if (investors.most_active.length) {
      out.push('*Most active this week*', '');
      for (const i of investors.most_active) {
        out.push(`- **${md(i.name)}**: ${i.deals} deal${i.deals === 1 ? '' : 's'} (${i.leads} led) · ${md(i.companies.join(', '))}`);
      }
      out.push('');
    }
    if (investors.new_in_focus === null) {
      out.push('*New investors in your sectors appear once 3 weeks of history exist.*', '');
    } else if (investors.new_in_focus.length) {
      out.push('*New to your sectors (first time in our data)*', '');
      for (const n of investors.new_in_focus.slice(0, 10)) {
        out.push(`- **${md(n.investor)}** → ${md(n.sector)}: ${n.lead ? 'led' : 'joined'} ${md(n.company)} (${md(n.amount_text || 'undisclosed')})${n.first_time_seen ? ' · not seen in any sector before' : ''}`);
      }
      out.push('');
    } else {
      out.push('*No investors new to your sectors this week.*', '');
    }
  }

  out.push(`## Other notable deals (${other.length})`, '');
  out.push(...(other.length ? other.map(shortLine) : ['None this week.']), '');

  out.push('---', '');
  out.push(
    `${stats.total_deals} deals, ${stats.disclosed_deals} with disclosed amounts totalling ~$${stats.total_disclosed_usd_m}M ` +
      `(INR converted at ${INR_PER_USD}/USD).`,
    '',
    `*${coverageFooter(counts)}*`
  );

  // Same content in structured form, so the web page can render tables,
  // stat tiles and a sector chart instead of a wall of markdown.
  const pick = (d) => ({
    company: d.company, amount_text: d.amount_text,
    amount_usd_m: d.amount_usd_m == null ? null : Number(d.amount_usd_m),
    stage: d.stage, sector: d.sector, lead_investor: d.lead_investor,
    other_investors: d.other_investors || [], headline: d.headline,
    source_name: d.source_name, source_url: d.source_url, origin: d.origin,
  });
  const data = {
    week_start: weekStart,
    summary: ai.summary || '',
    watch: watch.map((w) => ({ watch: w.watch, matched_on: w.matched_on, note: noteFor(ai.watchlist_notes, w.deal_id) || '', deal: pick(byId.get(w.deal_id)) })),
    adjacency: adjacency.map((a) => ({ portfolio: a.portfolio, sector: a.sector, keyword: a.keyword, note: noteFor(ai.adjacency_notes, a.deal_id) || '', deal: pick(byId.get(a.deal_id)) })),
    focus: focus.map(pick),
    sector_only: sectorOnly.map(pick),
    other: other.map(pick),
    patterns,
    stats,
    investors: investors || null,
    counts,
    inr_per_usd: INR_PER_USD,
    coverage: coverageFooter(counts),
  };

  return { md: out.join('\n'), data };
}
