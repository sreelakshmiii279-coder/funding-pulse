import { getConfig, query } from './db';
import { collect } from './collect';
import { extractAndStore } from './extract';
import { watchlistMatches, adjacencyMatches, rankDeals, computeStats } from './match';
import { writeBrief } from './brief';
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
    const { ranked, watch, adjacency, stats } = await time('match', async () => {
      const deals = await query('SELECT * FROM deals WHERE week_start = $1 ORDER BY id', [weekStart]);
      const ranked = rankDeals(deals, config);
      return {
        ranked,
        watch: watchlistMatches(ranked, config.watchlist),
        adjacency: adjacencyMatches(ranked, config.portfolio),
        stats: await computeStats(deals, weekStart),
      };
    });

    // Step 5: brief.
    const contentMd = await time('brief', () =>
      writeBrief({ weekStart, ranked, watch, adjacency, stats, config, counts: collected.counts })
    );

    // Step 6: save + email.
    const [brief] = await query(
      `INSERT INTO briefs (week_start, content_md, deals_count, sources_scanned, sources_failed)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [weekStart, contentMd, ranked.length,
       collected.counts.rss_feeds + collected.counts.google_news_queries, collected.counts.sources_failed]
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
