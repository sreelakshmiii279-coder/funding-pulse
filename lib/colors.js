// Colour follows the entity, never its rank: Aarav's focus sectors take the
// first categorical slots in config order, other sectors the next slots
// alphabetically, and anything past slot 8 folds into neutral grey.
const SLOTS = 8;

export function sectorColors(configSectors = [], allSectors = []) {
  const map = new Map();
  const lc = (s) => String(s || '').toLowerCase();
  let next = 1;
  for (const s of configSectors) if (!map.has(lc(s)) && next <= SLOTS) map.set(lc(s), next++);
  const rest = [...new Set(allSectors.filter(Boolean).map(lc))].filter((s) => !map.has(s) && s !== 'unknown').sort();
  for (const s of rest) if (next <= SLOTS) map.set(s, next++);
  return (sector) => {
    const i = map.get(lc(sector));
    return i ? `var(--c${i})` : 'var(--c-other)';
  };
}

// Stages are ordinal: one blue ramp from light (early) to dark (late).
const STAGE_STEP = {
  'pre-seed': 1, seed: 2, 'pre-series a': 3, 'series a': 3, 'series b': 4,
  'series c': 5, 'series d+': 6, growth: 6,
};

export function stageColor(stage) {
  const i = STAGE_STEP[String(stage || '').toLowerCase()];
  return i ? `var(--s${i})` : 'var(--c-other)';
}

const STAGE_ORDER = ['pre-seed', 'seed', 'pre-series a', 'series a', 'series b', 'series c', 'series d+', 'growth', 'bridge', 'debt'];

// Stages are ordinal, so list them in funding order with "not stated" last.
export function sortStages(rows) {
  const rank = (s) => {
    const i = STAGE_ORDER.indexOf(String(s || '').toLowerCase());
    return i === -1 ? 99 : i;
  };
  return [...rows].sort((a, b) => rank(a.stage) - rank(b.stage));
}
