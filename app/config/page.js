import { getConfig, query } from '@/lib/db';
import ConfigForm from './ConfigForm';

export const dynamic = 'force-dynamic';

const clean = (s) => String(s ?? '').trim().slice(0, 100);
const cleanList = (arr, max = 30) =>
  [...new Set((Array.isArray(arr) ? arr : []).map(clean).filter(Boolean))].slice(0, max);

async function saveConfig(cfg) {
  'use server';
  const sectors = cleanList(cfg.sectors);
  const stages = cleanList(cfg.stages);
  const watchlist = (cfg.watchlist || [])
    .map((w) => ({ name: clean(w.name), aliases: cleanList(w.aliases, 10) }))
    .filter((w) => w.name)
    .slice(0, 50);
  const portfolio = (cfg.portfolio || [])
    .map((p) => ({ name: clean(p.name), sector: clean(p.sector), keywords: cleanList(p.keywords, 20) }))
    .filter((p) => p.name && p.sector)
    .slice(0, 50);
  await query(
    `UPDATE config SET sectors = $1, stages = $2, watchlist = $3, portfolio = $4, updated_at = now() WHERE id = 1`,
    [sectors, stages, JSON.stringify(watchlist), JSON.stringify(portfolio)]
  );
  return { ok: true };
}

export default async function ConfigPage() {
  const config = await getConfig();
  return (
    <ConfigForm
      initial={{
        sectors: config.sectors,
        stages: config.stages,
        watchlist: config.watchlist,
        portfolio: config.portfolio,
      }}
      updatedAt={new Date(config.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
      save={saveConfig}
    />
  );
}
