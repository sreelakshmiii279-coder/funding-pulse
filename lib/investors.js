import { query } from './db';

// Investor activity (code only, no AI): who is backing deals this week, and
// which investors appear in one of Aarav's sectors for the first time in our
// stored history ("has a new investor started making moves in his verticals?").

const lc = (s) => String(s || '').toLowerCase().trim();

// "Blume Ventures" / "Blume" / "Blume Ventures LLP" -> "blume". Strips legal
// and generic fund words so one firm isn't counted as three.
export function investorKey(name) {
  let k = lc(name).replace(/&/g, 'and').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tail = /\s(ventures?|venture partners|capital|partners|vc|fund|advisors|investments?|llp|ltd|limited|management|group)$/;
  while (tail.test(k)) k = k.replace(tail, '');
  return k;
}

// Some extractions list angels as "Zoho co-founder" or "angel investors";
// those aren't trackable firms.
const isTrackable = (name) =>
  name && name.length > 1 && !/\b(angel investors?|others|existing investors|undisclosed|family offices?|co-?founder|hnis?)\b/i.test(name);

// Articles often name several firms in one field: "Sauce, OTP Ventures, and
// Huddle Ventures" is three investors. Split on commas and "and" (not "&",
// which is part of names like "Kae & Co"), and drop leftovers like "others".
const GENERIC = /^(and|others?|group|angels?|investors?|existing investors|family offices?|hnis?|co)$/i;
function splitNames(field) {
  return String(field || '')
    .split(/\s*,\s*|\s+and\s+/i)
    .map((s) => s.replace(/^(and|with)\s+/i, '').trim())
    .filter((s) => s && !GENERIC.test(s));
}

function investorsOf(d) {
  // Everyone named in the lead field co-led the round.
  const leads = new Set(splitNames(d.lead_investor).map(investorKey));
  const list = [...splitNames(d.lead_investor), ...(d.other_investors || []).flatMap(splitNames)].filter(isTrackable);
  const seen = new Map();
  for (const name of list) {
    const key = investorKey(name);
    if (key && !seen.has(key)) seen.set(key, { key, name, lead: leads.has(key) });
  }
  return [...seen.values()];
}

export async function investorActivity(deals, weekStart, config, priorWeeks) {
  const focus = new Set(config.sectors.map(lc));

  // This week, per investor.
  const byInv = new Map();
  for (const d of deals) {
    for (const inv of investorsOf(d)) {
      const e = byInv.get(inv.key) || { name: inv.name, deals: 0, leads: 0, sectors: new Set(), focus_deals: 0, companies: [] };
      e.deals++;
      if (inv.lead) e.leads++;
      if (d.sector) e.sectors.add(d.sector);
      if (focus.has(lc(d.sector))) e.focus_deals++;
      e.companies.push(d.company);
      byInv.set(inv.key, e);
    }
  }
  const all = [...byInv.entries()].map(([key, e]) => ({ key, ...e, sectors: [...e.sectors] }));

  // Most active: anyone in 2+ deals, else the leads of focus deals.
  let most_active = all.filter((e) => e.deals >= 2);
  if (!most_active.length) most_active = all.filter((e) => e.leads && e.focus_deals);
  most_active = most_active
    .sort((a, b) => b.deals - a.deals || b.leads - a.leads || b.focus_deals - a.focus_deals)
    .slice(0, 8)
    .map(({ key, ...e }) => e);

  // New in Aarav's verticals: investor x focus-sector pairs this week that
  // never appear in earlier weeks. Needs a baseline (>= 3 prior weeks), same
  // rule as trend claims, otherwise everything would look "new".
  let new_in_focus = null;
  if (priorWeeks >= 3) {
    const prior = await query(
      'SELECT lead_investor, other_investors, sector FROM deals WHERE week_start < $1',
      [weekStart]
    );
    const seenPair = new Set();
    const seenAny = new Set();
    for (const d of prior) {
      for (const inv of investorsOf(d)) {
        seenAny.add(inv.key);
        seenPair.add(`${inv.key}|${lc(d.sector)}`);
      }
    }
    new_in_focus = [];
    for (const d of deals) {
      if (!focus.has(lc(d.sector))) continue;
      for (const inv of investorsOf(d)) {
        if (seenPair.has(`${inv.key}|${lc(d.sector)}`)) continue;
        if (new_in_focus.some((n) => investorKey(n.investor) === inv.key && lc(n.sector) === lc(d.sector))) continue;
        new_in_focus.push({
          investor: inv.name,
          sector: d.sector,
          company: d.company,
          amount_text: d.amount_text,
          stage: d.stage,
          lead: inv.lead,
          first_time_seen: !seenAny.has(inv.key),
          source_name: d.source_name,
          source_url: d.source_url,
        });
      }
    }
    new_in_focus.sort((a, b) => Number(b.lead) - Number(a.lead));
  }

  return { investors_this_week: all.length, most_active, new_in_focus };
}
