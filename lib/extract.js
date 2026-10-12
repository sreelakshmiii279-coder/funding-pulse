import { generateJson, mapLimit } from './gemini';
import { query } from './db';
import { inrPerUsd, inrToUsdM, isInrAmount } from './fx';

const BATCH_SIZE = 20;
const CONCURRENCY = 3;

const STAGES = [
  'pre-seed', 'seed', 'pre-Series A', 'Series A', 'Series B', 'Series C',
  'Series D+', 'bridge', 'debt', 'growth', 'undisclosed',
];

const SYSTEM = `You extract startup funding announcements from news items for an Indian venture scout.
Rules:
- Only extract what is stated in the item's title or snippet. Use null when a field is not stated.
- Never guess amounts, investors, stages or dates.
- is_funding_announcement is true ONLY when the item announces that one specific India-based startup has raised (or closed) a funding round.
- It is false for: roundups covering many startups, funding trend/report articles, "in talks to raise" or "plans to raise", VC funds raising their own fund, IPOs, listed-company share sales, acquisitions, results/losses, and startups not based in India.
- company: the startup's name only (no descriptors like "D2C brand").
- amount_text: the amount exactly as reported, e.g. "Rs 40 Cr", "$5 Mn". null if undisclosed.
- amount_usd_m: a number ONLY when the text states the amount in US dollars (convert to millions, e.g. "$5 Mn" -> 5). Otherwise null.
- stage: one of ${STAGES.join(', ')}; use "undisclosed" when not stated.
- sector: a short lowercase label. Prefer one of these if it fits: {SECTORS}. Otherwise a short label like "edtech", "deeptech", "agritech", "mobility", "consumer".
- announced_on: YYYY-MM-DD if a date is stated or the item date is given; else null.
Return one result per input item, with the same "index".`;

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          is_funding_announcement: { type: 'boolean' },
          company: { type: ['string', 'null'] },
          amount_text: { type: ['string', 'null'] },
          amount_usd_m: { type: ['number', 'null'] },
          stage: { type: ['string', 'null'], enum: [...STAGES, null] },
          sector: { type: ['string', 'null'] },
          lead_investor: { type: ['string', 'null'] },
          other_investors: { type: 'array', items: { type: 'string' } },
          announced_on: { type: ['string', 'null'] },
          source_url: { type: ['string', 'null'] },
        },
        required: ['index', 'is_funding_announcement', 'company', 'amount_text', 'amount_usd_m', 'stage', 'sector', 'lead_investor', 'other_investors', 'announced_on', 'source_url'],
      },
    },
  },
  required: ['results'],
};

// "Week of" a run = the Monday (IST) of the Mon–Sun week that ended most
// recently. A Monday 6 AM cron run and a manual run later that week map to
// the same week, so the UNIQUE(company_key, stage, week_start) dedupe holds.
export function weekStart(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000 - 24 * 3600 * 1000);
  const day = ist.getUTCDay(); // 0 = Sunday
  ist.setUTCDate(ist.getUTCDate() - ((day + 6) % 7));
  return ist.toISOString().slice(0, 10);
}

export function companyKey(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(pvt|private|ltd|limited|inc|llp|technologies|technology|labs)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

// Re-convert every rupee amount stored for a week at that week's live rate
// (fixes rows converted earlier at a different or fallback rate).
export async function reconvertWeek(week, fx) {
  const rows = await query(
    'SELECT id, amount_text FROM deals WHERE week_start = $1 AND (fx_inr_per_usd IS NULL OR fx_inr_per_usd <> $2)',
    [week, fx.rate]
  );
  let n = 0;
  for (const r of rows) {
    if (!isInrAmount(r.amount_text)) continue;
    await query('UPDATE deals SET amount_usd_m = $2, fx_inr_per_usd = $3 WHERE id = $1', [r.id, inrToUsdM(r.amount_text, fx.rate), fx.rate]);
    n++;
  }
  return n;
}

// The rate for a week = the rate on its last day (Sunday), or latest if that's in the future.
export async function rateForWeek(week) {
  const end = new Date(Date.parse(week) + 6 * 864e5).toISOString().slice(0, 10);
  return inrPerUsd(end);
}

// Gemini may return "d2c" for the config's "D2C"; use the config's spelling
// so stats don't split one sector into two. Other sectors are lowercased.
function canonicalSector(sector, configSectors) {
  const s = sector?.trim();
  if (!s) return null;
  return configSectors.find((c) => c.toLowerCase() === s.toLowerCase()) || s.toLowerCase();
}

const filled = (d) =>
  ['amount_text', 'amount_usd_m', 'sector', 'lead_investor', 'announced_on'].filter((k) => d[k] != null).length +
  (d.stage !== 'undisclosed' ? 1 : 0) +
  (d.other_investors?.length ? 1 : 0);

async function extractBatch(batch, sectors) {
  const prompt = JSON.stringify(
    batch.map((it, index) => ({
      index,
      title: it.title,
      snippet: it.snippet,
      source: it.source_name,
      url: it.url,
      date: it.published ? new Date(it.published).toISOString().slice(0, 10) : null,
    }))
  );
  const out = await generateJson({ system: SYSTEM.replace('{SECTORS}', sectors.join(', ')), prompt, schema: SCHEMA });
  return out.results || [];
}

// Step 3: Gemini extraction -> code dedupe/merge -> insert into deals.
export async function extractAndStore({ items, manual, config, now = new Date(), deadline = Infinity }) {
  const week = weekStart(now);
  const fx = await rateForWeek(week);
  const all = [...items, ...manual];
  const batches = [];
  for (let i = 0; i < all.length; i += BATCH_SIZE) batches.push(all.slice(i, i + BATCH_SIZE));

  let failedBatches = 0;
  let firstError = null;
  let skippedBatches = 0;
  const batchResults = await mapLimit(batches, CONCURRENCY, async (batch) => {
    // Out of time: skip the rest rather than let Vercel kill the run.
    if (Date.now() > deadline) {
      skippedBatches++;
      return { batch, results: [] };
    }
    try {
      return { batch, results: await extractBatch(batch, config.sectors) };
    } catch (err) {
      failedBatches++;
      firstError ||= err.message;
      console.error('[extract] batch failed:', err.message);
      return { batch, results: [] };
    }
  });

  // If Gemini failed on every batch, stop the run rather than publish an
  // empty brief that looks like a quiet week.
  if (batches.length && failedBatches + skippedBatches === batches.length && failedBatches > 0) {
    throw new Error(`Gemini extraction failed for all ${batches.length} batches: ${String(firstError).slice(0, 300)}`);
  }

  // Map model output back to the original item by index. The source URL
  // always comes from the feed item, never from the model.
  const candidates = [];
  for (const { batch, results } of batchResults) {
    for (const r of results) {
      const item = batch[r.index];
      if (!item || !r.is_funding_announcement || !r.company) continue;
      const key = companyKey(r.company);
      if (!key) continue;
      // Rupee amounts are converted in code at the week's live rate; Gemini
      // only supplies a USD figure when the article itself states dollars.
      const amountUsd = isInrAmount(r.amount_text) ? inrToUsdM(r.amount_text, fx.rate) : r.amount_usd_m ?? null;
      candidates.push({
        week_start: week,
        company: r.company.trim(),
        company_key: key,
        amount_text: r.amount_text,
        amount_usd_m: amountUsd,
        stage: r.stage || 'undisclosed',
        sector: canonicalSector(r.sector, config.sectors),
        lead_investor: r.lead_investor,
        other_investors: r.other_investors || [],
        headline: item.title,
        source_name: item.source_name,
        source_url: item.url || `telegram:submission/${item.manual_id}`,
        announced_on: /^\d{4}-\d{2}-\d{2}$/.test(r.announced_on || '') ? r.announced_on : null,
        origin: item.origin,
        manual_id: item.manual_id,
      });
    }
  }

  // Outlets name the same startup differently ("TailBlaze" vs "TailBlaze
  // Longevity"). If one key is a prefix of another (5+ chars), reuse the key
  // seen first: keys already stored for this week, then earlier candidates.
  // Reusing a stored key makes ON CONFLICT skip the repeat.
  const stored = await query('SELECT DISTINCT company_key FROM deals WHERE week_start = $1', [week]);
  const known = stored.map((r) => r.company_key);
  for (const c of candidates) {
    const same = known.find((k) => Math.min(k.length, c.company_key.length) >= 5 && (k.startsWith(c.company_key) || c.company_key.startsWith(k)));
    if (same) c.company_key = same;
    else known.push(c.company_key);
  }

  // Merge the same round reported by several outlets: same company_key and
  // same stage (an "undisclosed" stage merges into the known one). Keep the
  // record with the most fields filled; a manual forward wins ties so Aarav
  // can see his submission was used.
  const byCompany = new Map();
  for (const c of candidates) {
    const list = byCompany.get(c.company_key) || [];
    const match = list.find((d) => d.stage === c.stage || d.stage === 'undisclosed' || c.stage === 'undisclosed');
    if (!match) {
      list.push({ ...c, outlets: 1 });
    } else {
      const better = filled(c) > filled(match) || (filled(c) === filled(match) && c.origin === 'manual');
      const merged = better ? { ...c, outlets: match.outlets + 1 } : { ...match, outlets: match.outlets + 1 };
      if (merged.stage === 'undisclosed') merged.stage = c.stage !== 'undisclosed' ? c.stage : match.stage;
      list[list.indexOf(match)] = merged;
    }
    byCompany.set(c.company_key, list);
  }
  const deals = [...byCompany.values()].flat();

  // Cross-week dedupe: a round announced late one week is often re-reported
  // early the next. Skip it if the same company + stage is already stored in
  // the neighbouring week (before, or after when backfilling history), so
  // weekly counts (and trends) don't double it.
  const shift = (days) => new Date(Date.parse(week) + days * 864e5).toISOString().slice(0, 10);
  const recent = await query(
    'SELECT company_key, stage FROM deals WHERE week_start = ANY($1::date[])',
    [[shift(-7), shift(7)]]
  );
  const recentKeys = new Set(recent.map((r) => `${r.company_key}|${r.stage}`));
  const recentCompanies = new Set(recent.map((r) => r.company_key));
  let skippedRepeats = 0;

  // Same week, same company, but one record has no stage: it's the same
  // round. A stage-less newcomer is skipped; a newcomer that knows the stage
  // fills in the stored stage-less row instead of adding a second row.
  const thisWeek = await query('SELECT id, company_key, stage FROM deals WHERE week_start = $1', [week]);
  let inserted = 0;
  let filledIn = 0;
  for (const d of deals) {
    if (recentKeys.has(`${d.company_key}|${d.stage}`) || (d.stage === 'undisclosed' && recentCompanies.has(d.company_key))) {
      skippedRepeats++;
      continue;
    }
    const sameCompany = thisWeek.filter((r) => r.company_key === d.company_key);
    if (sameCompany.length && d.stage === 'undisclosed') continue;
    const stageless = sameCompany.find((r) => r.stage === 'undisclosed');
    if (stageless && !sameCompany.some((r) => r.stage === d.stage)) {
      await query(
        `UPDATE deals SET stage = $2,
           amount_text = coalesce(amount_text, $3), amount_usd_m = coalesce(amount_usd_m, $4),
           lead_investor = coalesce(lead_investor, $5), sector = coalesce(sector, $6)
         WHERE id = $1`,
        [stageless.id, d.stage, d.amount_text, d.amount_usd_m, d.lead_investor, d.sector]
      );
      stageless.stage = d.stage;
      filledIn++;
      continue;
    }
    const rows = await query(
      `INSERT INTO deals (week_start, company, company_key, amount_text, amount_usd_m, stage, sector,
         lead_investor, other_investors, headline, source_name, source_url, announced_on, origin, fx_inr_per_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (company_key, stage, week_start) DO NOTHING
       RETURNING id`,
      [d.week_start, d.company, d.company_key, d.amount_text, d.amount_usd_m, d.stage, d.sector,
       d.lead_investor, d.other_investors, d.headline, d.source_name, d.source_url, d.announced_on, d.origin,
       isInrAmount(d.amount_text) ? fx.rate : null]
    );
    inserted += rows.length;
  }
  const reconverted = await reconvertWeek(week, fx);

  // Every manual submission sent to Gemini this run is now processed,
  // whether or not it turned out to be a funding announcement.
  const manualIds = manual.map((m) => m.manual_id);
  if (manualIds.length && failedBatches === 0) {
    await query('UPDATE manual_submissions SET processed = true WHERE id = ANY($1::int[])', [manualIds]);
  }

  return {
    week_start: week,
    stats: {
      items_sent: all.length,
      batches: batches.length,
      failed_batches: failedBatches,
      skipped_batches_time_budget: skippedBatches,
      funding_items: candidates.length,
      unique_deals: deals.length,
      repeats_from_last_week: skippedRepeats,
      stage_filled_in: filledIn,
      inserted,
      reconverted,
    },
    fx,
    deals,
  };
}
