# Funding Pulse

A Monday-morning brief of last week's Indian startup funding rounds for Aarav, a venture scout at a Bengaluru family office. Watchlist alerts and possible portfolio adjacencies come first, then focus-sector deals, patterns with counts, and everything else, each with its source link.

**Stack:** Next.js (App Router) on Vercel · Neon Postgres · Gemini Flash (all AI) · RSS + Google News RSS · Resend · Telegram Bot API.

## How a run works (`/api/run`)

| Step | Where | What happens |
|---|---|---|
| 1. Collect | `lib/collect.js`, `lib/sources.js` | 12 verified RSS feeds + Google News queries generated from the config (one per sector, one per watchlist company, two generic) + unprocessed Telegram forwards. Fetched in parallel with a 10 s timeout each; a failed feed is counted, never fatal. Last 7 days only; deduped by URL and near-identical title. |
| 2. Pre-filter | `lib/collect.js` | Code-only keyword filter: title must have a funding action word (raises, secures, round, led by…). Cuts ~450 items to ~170. |
| 3. Extract | `lib/extract.js` | Gemini Flash, JSON mode with a response schema, 20 items per call, 3 calls at a time. Only stated facts; null otherwise; India-based only. Source URL is taken from the feed item, never from the model. Code then merges the same round from several outlets and inserts with `ON CONFLICT DO NOTHING`. |
| 4. Match + compute | `lib/match.js` | Code only: watchlist name/alias match, possible portfolio adjacency (same sector + keyword), stats by sector/stage, 4-week sector average once ≥3 prior weeks exist, focus ranking. |
| 5. Write | `lib/brief.js` | Gemini Flash writes the summary, alert notes and 3–5 pattern bullets. Code renders every deal line and link, drops any pattern without a number, and drops trend words when history < 3 weeks. |
| 6. Deliver | `lib/pipeline.js`, `lib/email.js` | Saved to `briefs`, emailed to `BRIEF_TO_EMAIL` only, returned in the API response. Each run is logged in `runs` with per-source status and per-step timings. |

Triggers: Vercel cron every Monday 00:30 UTC = 06:00 IST (`vercel.json`, authenticated with `CRON_SECRET`), and the **Run now** button on `/admin`.

## Pages

- `/`: latest brief (public).
- `/briefs/<id>`: any past brief.
- `/admin`: Run now, last run's per-source status, past briefs.
- `/config`: sectors, stages, watchlist (+ aliases), portfolio (+ sector, keywords).
- `/api/health`: checks the Neon connection.

There is no login: `/admin` and `/config` are open by choice for this single-user demo. Only the cron's GET to `/api/run` is checked (Vercel sends `CRON_SECRET`), so opening the URL can't start a run.

## Telegram

Aarav forwards LinkedIn/X funding posts to the bot; they're stored in `manual_submissions` and extracted on the next run with `origin = 'manual'`. Commands: `/start`, `/status`. Messages from any chat other than `TELEGRAM_ALLOWED_CHAT_ID` are ignored, and the webhook rejects calls without Telegram's secret-token header.

After deploying, register the webhook once by calling Telegram's `setWebhook` with `url = https://<your-deployment>/api/telegram` and `secret_token` = the SHA-256 hex of `telegram:<TELEGRAM_BOT_TOKEN>` (the value `webhookSecret()` in `app/api/telegram/route.js` checks).

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
