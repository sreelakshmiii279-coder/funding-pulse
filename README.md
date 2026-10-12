# Funding Pulse

A Monday-morning brief of last week's Indian startup funding rounds for Aarav, a venture scout at a Bengaluru family office. Watchlist alerts and possible portfolio adjacencies come first, then focus-sector deals, patterns with counts, his sectors vs their 4-week average (accelerating / cooling), investor activity (most active, and investors new to his sectors), and everything else, each with its source link.

## Assignment coverage

| Problem statement asks | Where |
|---|---|
| Live external data | 12 RSS feeds + config-driven Google News searches + newswire/press-release searches, every run |
| All AI on Gemini Flash | `lib/gemini.js` (model from `GEMINI_MODEL`); used for extraction and brief writing only |
| Monday-morning brief, previous week | Vercel cron `30 0 * * 1` (06:00 IST), last 7 days |
| Sources: startup media, press releases, newswires, LinkedIn posts | Media: RSS + Google News. Press releases / newswires: Google News limited to PR Newswire, BusinessWire, GlobeNewswire. LinkedIn/X: cannot be scraped, so Aarav forwards posts to the Telegram bot |
| Signal from noise | Code pre-filter, Gemini extraction, cross-outlet and cross-week dedupe |
| Focus sectors and stages first | Focus ranking in `lib/match.js`; “Focus deals” section |
| Patterns Gemini detects across the week | Gemini writes 3–5 patterns from code-computed counts (`lib/brief.js`) |
| Which sectors are attracting capital | Deals and disclosed $ by sector and stage |
| Space his portfolio touches accelerating or cooling | Per-sector this week vs 4-week average; direction computed in code; portfolio sectors always shown |
| New investor making moves in his verticals | `lib/investors.js`: investors appearing in a focus sector for the first time in stored history; most active investors |
| Watchlist flag | Name/alias match in code; top of the brief |
| Config he updates himself | `/config` |
| Adjacent companies raising (the board-meeting miss) | “Possible adjacency”: same sector as a portfolio company + keyword match |

**Stack:** Next.js (App Router) on Vercel · Neon Postgres · Gemini Flash (all AI, incl. Google Search grounding) · RSS + Google News RSS + GDELT · Frankfurter (live INR/USD) · Resend · Telegram Bot API.

## External APIs

| API | Used for | Key |
|---|---|---|
| Gemini API (Flash) | Extracting deals, writing the brief, fact-checking focus deals with Google Search grounding | `GEMINI_API_KEY` |
| Neon Postgres | Config, deals, forwards, briefs, run log | `DATABASE_URL` |
| Resend | Emailing the brief to Aarav only | `RESEND_API_KEY` |
| Telegram Bot API | Aarav forwards LinkedIn/X posts | `TELEGRAM_BOT_TOKEN` |
| Publisher RSS + Google News RSS | Live news | none (public) |
| GDELT DOC 2.0 | Extra news index across thousands of outlets (one request per run; optional, failure is non-fatal) | none (public) |
| Frankfurter | Live INR/USD rate per week (ECB reference rates), replacing a fixed ₹88 | none (public) |

## How a run works (`/api/run`)

| Step | Where | What happens |
|---|---|---|
| 1. Collect | `lib/collect.js`, `lib/sources.js` | 12 verified RSS feeds + Google News queries generated from the config (one per sector, one per watchlist company, two generic) + unprocessed Telegram forwards. Fetched in parallel with a 10 s timeout each; a failed feed is counted, never fatal. Last 7 days only; deduped by URL and near-identical title. |
| 2. Pre-filter | `lib/collect.js` | Code-only keyword filter: title must have a funding action word (raises, secures, round, led by…). Cuts ~450 items to ~170. |
| 3b. Fact-check | `lib/verify.js` | Gemini Flash + Google Search grounding checks up to 12 focus-sector deals per run. “Verified” only when the search returned web sources that agree; fills blank fields only, never overwrites; flags amount mismatches. Skips cleanly when the free search quota is used up. |
| 3. Extract | `lib/extract.js` | Gemini Flash, JSON mode with a response schema, 20 items per call, 3 calls at a time. Only stated facts; null otherwise; India-based only. Source URL is taken from the feed item, never from the model. Code then merges the same round from several outlets and inserts with `ON CONFLICT DO NOTHING`. |
| 4. Match + compute | `lib/match.js`, `lib/investors.js` | Code only: watchlist name/alias match, possible portfolio adjacency (same sector + keyword), stats by sector/stage, focus ranking. Once ≥3 prior weeks exist: each focus/portfolio sector vs its 4-week average with a direction label (up = ≥1.5× and +2 deals, down = ≤0.5× and −2), and investors appearing in a focus sector for the first time in stored history. |
| 5. Write | `lib/brief.js` | Gemini Flash writes the summary, alert notes and 3–5 pattern bullets. Code renders every deal line and link, drops any pattern without a number, and drops trend words unless the code labelled that sector up/down. |
| 6. Deliver | `lib/pipeline.js`, `lib/email.js` | Saved to `briefs`, emailed to `BRIEF_TO_EMAIL` only, returned in the API response. Each run is logged in `runs` with per-source status and per-step timings. |

Triggers: Vercel cron every Monday 00:30 UTC = 06:00 IST (`vercel.json`, authenticated with `CRON_SECRET`), and the **Run now** button on `/admin`.

## History backfill

Trend and new-investor comparisons need a baseline, so past weeks can be backfilled once with `GET /api/backfill?weeks_ago=1..4` (admin or `CRON_SECRET`). It searches Google News for exactly that Mon–Sun range, including `site:` searches for the same outlets as the RSS feeds, then runs the normal Gemini extraction and storage (no brief, no email). Backfilled weeks are listed under the trend table, since archive search can miss a few deals the live feeds catch. A round re-reported in the neighbouring week is skipped so it isn't counted twice.

## Pages

- `/`: latest brief (public).
- `/briefs/<id>`: any past brief.
- `/admin`: Run now, last run's per-source status, past briefs. Password: `ADMIN_PASSWORD`.
- `/config`: sectors, stages, watchlist (+ aliases), portfolio (+ sector, keywords). Password: `ADMIN_PASSWORD`.
- `/api/health`: checks the Neon connection.

## Telegram

Aarav forwards LinkedIn/X funding posts to the bot; they're stored in `manual_submissions` and extracted on the next run with `origin = 'manual'`. Commands: `/start`, `/status`. Messages from any chat other than `TELEGRAM_ALLOWED_CHAT_ID` are ignored, and the webhook rejects calls without Telegram's secret-token header.

After deploying, log in at `/admin`, then open `/api/telegram?setup=1` once to register the webhook (it calls Telegram `setWebhook` with this deployment's URL and the secret token). `/api/telegram` (GET, admin) shows `getWebhookInfo`.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in.
3. Run `db/schema.sql` in the Neon SQL editor (or `node --env-file=.env.local scripts/apply-schema.mjs`). This drops and recreates all tables.
4. `npm run dev`

## Scope decisions

- **LinkedIn and X are not scraped** (check 03: not accessible). The Telegram bot is the manual channel, and every brief's footer says so.
- **Nothing is sent to anyone except Aarav.** The only outbound message is the brief email to `BRIEF_TO_EMAIL`, plus bot replies in Aarav's own chat.
- **USD figures** come from the article when it reports dollars; INR amounts are converted in code at a fixed `INR_PER_USD = 88` (`lib/extract.js`), and the brief states the rate.
- **Week label:** each deal is filed under the Monday of the Mon–Sun week that ended most recently (IST), so a Monday cron run and a later manual run share one week and dedupe correctly.
- **`runs` table:** added to the brief's schema so `/admin` can show per-source status.
- **`briefs.data` column:** the brief's structured content (deals, stats, alerts, trends, investors) so the web page can render tables and charts.
- **"New" investor** means first time in our stored history, not first time ever; the page says so.
