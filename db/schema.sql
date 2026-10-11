-- Funding Pulse schema. Paste the whole file into the Neon SQL editor and run it.
-- WARNING: drops and recreates every table (all existing data is lost).

DROP TABLE IF EXISTS runs;
DROP TABLE IF EXISTS briefs;
DROP TABLE IF EXISTS manual_submissions;
DROP TABLE IF EXISTS deals;
DROP TABLE IF EXISTS config;

-- Aarav's editable settings. Exactly one row (id = 1).
CREATE TABLE config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sectors TEXT[] NOT NULL DEFAULT '{}',
  stages TEXT[] NOT NULL DEFAULT '{}',
  watchlist JSONB NOT NULL DEFAULT '[]',   -- [{ "name": "...", "aliases": ["..."] }]
  portfolio JSONB NOT NULL DEFAULT '[]',   -- [{ "name": "...", "sector": "...", "keywords": ["..."] }]
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Every extracted funding deal, one row per company + stage + week.
CREATE TABLE deals (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  company TEXT NOT NULL,
  company_key TEXT NOT NULL,              -- normalised lowercase name for dedupe
  amount_text TEXT,                       -- as reported, e.g. "Rs 40 Cr", "$5M"
  amount_usd_m NUMERIC,                   -- best-effort USD millions, nullable
  stage TEXT,
  sector TEXT,
  lead_investor TEXT,
  other_investors TEXT[],
  headline TEXT,
  source_name TEXT,
  source_url TEXT NOT NULL,
  announced_on DATE,
  origin TEXT NOT NULL DEFAULT 'rss',     -- 'rss' | 'google_news' | 'manual'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_key, stage, week_start)
);
CREATE INDEX deals_week_idx ON deals (week_start);

-- Posts Aarav forwards to the Telegram bot (LinkedIn/X gap filler).
CREATE TABLE manual_submissions (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed BOOLEAN DEFAULT false
);

-- Every brief generated, for history and coverage measurement.
CREATE TABLE briefs (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  content_md TEXT NOT NULL,
  deals_count INT,
  sources_scanned INT,
  sources_failed INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Addition to the brief's schema: a log of each pipeline run so /admin can
-- show the last run's per-source status (ok/failed, items found) and timings.
CREATE TABLE runs (
  id SERIAL PRIMARY KEY,
  trigger TEXT NOT NULL,                  -- 'cron' | 'manual'
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running' | 'ok' | 'error'
  source_status JSONB NOT NULL DEFAULT '[]', -- [{ "name", "url", "ok", "items", "error" }]
  timings JSONB NOT NULL DEFAULT '{}',    -- { "collect_ms": ..., "extract_ms": ... }
  brief_id INT REFERENCES briefs(id) ON DELETE SET NULL,
  error TEXT
);

-- Day-one placeholder config. Aarav edits all of this on /config.
INSERT INTO config (id, sectors, stages, watchlist, portfolio) VALUES (
  1,
  ARRAY['fintech', 'healthtech', 'climate tech', 'D2C', 'B2B SaaS'],
  ARRAY['pre-seed', 'seed', 'Series A'],
  '[
    { "name": "Snabbit",     "aliases": ["Snabbit Technologies"] },
    { "name": "Ultrahuman",  "aliases": ["Ultrahuman Healthcare"] },
    { "name": "Atlys",       "aliases": ["Atlys Visa"] },
    { "name": "Kiwi",        "aliases": ["Kiwi credit card", "Kiwi UPI"] },
    { "name": "Sarvam AI",   "aliases": ["Sarvam"] }
  ]'::jsonb,
  '[
    { "name": "Example Portfolio: PayNest", "sector": "fintech",
      "keywords": ["UPI", "lending", "credit", "BNPL", "payments"] },
    { "name": "Example Portfolio: CareLoop", "sector": "healthtech",
      "keywords": ["diagnostics", "telemedicine", "clinic", "pharmacy"] }
  ]'::jsonb
);
