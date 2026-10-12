import { GoogleGenAI } from '@google/genai';
import { query } from './db';
import { mapLimit } from './gemini';

// Fact-check focus deals with Gemini Flash + Google Search grounding.
//
// Gemini searches the web for the round and reports what the sources say.
// A deal is only marked "verified" when the search actually returned web
// sources AND they agree with the stored record. Testing showed two traps:
// asking for JSON output (or "reply with ONLY JSON") alongside the search
// tool makes Gemini restate the prompt without searching. So the prompt is a
// natural research question, the answer is prose, and a JSON block at the
// end is parsed. No sources returned = not verified, whatever the text says.
//
// The free tier's search allowance is small. On a 429 the remaining checks
// are skipped (left unchecked, retried next run) instead of failing the run.
//
// It never overwrites what the news said: it only fills fields that were
// missing (stage, lead investor, amount) and flags disagreements.

const MAX_PER_RUN = 12;
const CONCURRENCY = 3;
const STAGES = ['pre-seed', 'seed', 'pre-Series A', 'Series A', 'Series B', 'Series C', 'Series D+', 'bridge', 'debt', 'growth'];
const FENCE = '`'.repeat(3);

function prompt(d) {
  const reported = [
    d.amount_text || 'amount not stated',
    d.stage === 'undisclosed' ? 'stage not stated' : d.stage,
    d.lead_investor ? `led by ${d.lead_investor}` : 'lead investor not stated',
  ].join(', ');
  return [
    `Search Google for news about ${d.company} raising funding in India recently.`,
    'What do the sources say about the amount, the round stage and the lead investor?',
    `Compare with this report: ${reported}.`,
    '',
    'Answer in 2-3 sentences using only what the sources say. Then end with a JSON block:',
    `${FENCE}json`,
    `{"found": true, "amount_text": "as the sources state it, or null", "stage": "one of ${STAGES.join(' | ')} or null", "lead_investor": "or null", "amount_matches": true, "note": "one short sentence"}`,
    FENCE,
    'Set "found" to false if no source mentions this round, and "amount_matches" to false if the sources give a different amount (null if they give none).',
  ].join('\n');
}

function parseJson(text) {
  const t = String(text || '');
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const bare = t.match(/(\{[\s\S]*\})/);
  for (const m of [fenced, bare]) {
    if (!m) continue;
    try {
      return JSON.parse(m[1]);
    } catch {
      /* try the next shape */
    }
  }
  return null;
}

let ai;
async function checkDeal(d) {
  ai ||= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 45000 } });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL,
    contents: prompt(d),
    config: { tools: [{ googleSearch: {} }], temperature: 0 },
  });
  const gm = res.candidates?.[0]?.groundingMetadata;
  const sources = (gm?.groundingChunks || [])
    .map((c) => c.web && { title: c.web.title || 'source', uri: c.web.uri })
    .filter(Boolean)
    .slice(0, 4);
  return { answer: parseJson(res.text), sources };
}

export async function verifyDeals(deals, { deadline = Infinity } = {}) {
  const todo = deals.filter((d) => !d.verify_status).slice(0, MAX_PER_RUN);
  let quotaHit = false;
  const results = await mapLimit(todo, CONCURRENCY, async (d) => {
    if (quotaHit || Date.now() > deadline) return 'skipped';
    try {
      const { answer, sources } = await checkDeal(d);
      let status = 'unconfirmed';
      if (answer?.found && sources.length) status = answer.amount_matches === false ? 'mismatch' : 'verified';
      const note = sources.length
        ? answer?.note?.slice(0, 300) || ''
        : 'The search returned no web sources for this round, so it could not be checked.';
      const stage = STAGES.includes(answer?.stage) ? answer.stage : null;
      // Fill only what the news left blank, and only from a sourced answer.
      const fill = status !== 'unconfirmed';
      await query(
        `UPDATE deals SET verify_status = $2, verify_note = $3, verify_sources = $4, verified_at = now(),
           lead_investor = CASE WHEN $5 AND lead_investor IS NULL THEN $6 ELSE lead_investor END,
           amount_text   = CASE WHEN $5 AND amount_text IS NULL THEN $7 ELSE amount_text END,
           stage         = CASE WHEN $5 AND stage = 'undisclosed' AND $8::text IS NOT NULL
                                 AND NOT EXISTS (SELECT 1 FROM deals x WHERE x.company_key = deals.company_key
                                                 AND x.week_start = deals.week_start AND x.stage = $8::text)
                                THEN $8::text ELSE stage END
         WHERE id = $1`,
        [d.id, status, note, JSON.stringify(sources), fill, answer?.lead_investor || null, answer?.amount_text || null, stage]
      );
      return status;
    } catch (err) {
      if (err.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(err.message)) {
        quotaHit = true;
        return 'skipped';
      }
      console.warn('[verify] failed for', d.company, err.message);
      return 'error';
    }
  });
  const count = (s) => results.filter((r) => r === s).length;
  return {
    checked: todo.length - count('skipped'),
    verified: count('verified'),
    mismatch: count('mismatch'),
    unconfirmed: count('unconfirmed'),
    errors: count('error'),
    skipped: count('skipped'),
    quota_reached: quotaHit,
  };
}
