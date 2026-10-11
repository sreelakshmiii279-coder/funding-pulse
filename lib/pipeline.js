import { getConfig, query } from './db';
import { collect } from './collect';
import { extractAndStore, weekStart as weekOf } from './extract';
import { watchlistMatches, adjacencyMatches, rankDeals, computeStats } from './match';
import { writeBrief } from './brief';
import { investorActivity } from './investors';
import { sendBriefEmail } from './email';

// The whole Monday run, step by step, with a timing for each step.
// `stopAfter` lets /api/run?dry=collect stop early for testing.
export async function runPipeline({ trigger, stopAfter = null }) {
  const timings = {};
  const time = async (name, fn) => {
    const t = Date.now();
    const out = await fn();
    timings[`${name}_ms`] = Date.now() - t;
    console.log(`[run] ${name}: ${timings[`${name}_ms`]}ms`);
    return out;
  };

  const config = await getConfig();
  const collected = await time('collect', () => collect(config));
  const sourceStatus = collected.sourceStatus.map(({ name, origin, ok, items, fresh, error, ms }) => ({ name, origin, ok, items, fresh, error, ms }));

  if (stopAfter === 'collect') {
    return {
      counts: collected.counts,
      timings,
      sources: sourceStatus,
      sample: collected.items.slice(0, 15).map((i) => ({ title: i.title, source: i.source_name, url: i.url, published: i.published })),
    };
  }

  const [run] = await query(
    'INSERT INTO runs (trigger, source_status) VALUES ($1, $2) RETURNING id',
    [trigger, JSON.stringify(sourceStatus)]
  );

  try {
    const extracted = await time('extract', () =>
      extractAndStore({ items: collected.items, manual: collected.manual, config })
    );

    // Step 4: match + compute over every deal stored for this week (earlier
    // runs in the same week included), straight from Neon.
    const weekStart = extracted.week_start;
    const { ranked, watch, adjacency, stats, investors } = await time('match', async () => {
      const deals = await query('SELECT * FROM deals WHERE week_start = $1 ORDER BY id', [weekStart]);
      const ranked = rankDeals(deals, config);
      const stats = await computeStats(deals, weekStart, config);
      stats.backfilled_weeks = (
        await query(`SELECT DISTINCT substr(trigger, 10) AS week FROM runs WHERE trigger LIKE 'backfill:%' AND status = 'ok' ORDER BY 1`)
      ).map((r) => r.week);
      return {
        ranked,
        watch: watchlistMatches(ranked, config.watchlist),
        adjacency: adjacencyMatches(ranked, config.portfolio),
        stats,
        investors: await investorActivity(deals, weekStart, config, stats.prior_weeks),
      };
    });

    // Step 5: brief.
    const { md: contentMd, data: briefData } = await time('brief', () =>
      writeBrief({ weekStart, ranked, watch, adjacency, stats, config, counts: collected.counts, investors })
    );

    // Step 6: save + email.
    const [brief] = await query(
      `INSERT INTO briefs (week_start, content_md, deals_count, sources_scanned, sources_failed, data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [weekStart, contentMd, ranked.length,
       collected.counts.rss_feeds + collected.counts.google_news_queries, collected.counts.sources_failed, JSON.stringify(briefData)]
    );
    const email = await time('email', () => sendBriefEmail({ weekStart, contentMd }));

    await query(
      `UPDATE runs SET status = 'ok', finished_at = now(), timings = $2, brief_id = $3, error = $4 WHERE id = $1`,
      [run.id, JSON.stringify(timings), brief.id, email.sent ? null : `Email not sent: ${email.error}`]
    );
    return {
      run_id: run.id,
      brief_id: brief.id,
      week_start: weekStart,
      counts: collected.counts,
      extract: extracted.stats,
      matches: { watchlist: watch, adjacency },
      stats,
      email,
      timings,
      brief_md: contentMd,
    };
  } catch (err) {
    await query(
      `UPDATE runs SET status = 'error', finished_at = now(), timings = $2, error = $3 WHERE id = $1`,
      [run.id, JSON.stringify(timings), err.message]
    );
    throw err;
  }
}

// One-off history backfill: re-collects a past Mon–Sun week from Google News
// archives (date-ranged searches incl. the same outlets as the RSS feeds),
// extracts and stores its deals. No brief, no email. This gives the trend and
// "new investor" comparisons a real baseline from day one.
// weeksAgo = 1 means the week before the current brief's week.
export async function backfillWeek({ weeksAgo }) {
  const config = await getConfig();
  const current = weekOf(new Date()); // e.g. 2026-10-05
  const [y, m, d] = current.split('-').map(Number);
  // Monday 00:00 IST of the target week, as a UTC instant.
  const since = new Date(Date.UTC(y, m - 1, d - 7 * weeksAgo) - 5.5 * 3600 * 1000);
  const until = new Date(since.getTime() + 7 * 864e5);
  const label = new Date(since.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

  const collected = await collect(config, { range: { since, until } });
  const sourceStatus = collected.sourceStatus.map(({ name, origin, ok, items, fresh, error, ms }) => ({ name, origin, ok, items, fresh, error, ms }));
  const [run] = await query('INSERT INTO runs (trigger, source_status) VALUES ($1, $2) RETURNING id', [
    `backfill:${label}`, JSON.stringify(sourceStatus),
  ]);
  try {
    // `now` = the Monday after the week, so weekStart() files deals under it.
    const extracted = await extractAndStore({ items: collected.items, manual: [], config, now: until });
    await query(`UPDATE runs SET status = 'ok', finished_at = now() WHERE id = $1`, [run.id]);
    return { week_start: extracted.week_start, counts: collected.counts, extract: extracted.stats };
  } catch (err) {
    await query(`UPDATE runs SET status = 'error', finished_at = now(), error = $2 WHERE id = $1`, [run.id, err.message]);
    throw err;
  }
}
