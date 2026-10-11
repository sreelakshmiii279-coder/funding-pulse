'use client';

import { useState } from 'react';

const splitList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

// A list of short values shown as removable chips, plus an "Add" box.
function ChipList({ title, hint, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <section className="card">
      <div className="card-title">
        <h2>{title}</h2>
        <span className="hint">{hint}</span>
      </div>
      <div className="chips">
        {values.map((v) => (
          <span className="chip" key={v}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        {!values.length && <span className="muted">None yet.</span>}
      </div>
      <div className="row">
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button type="button" className="secondary" onClick={add}>Add</button>
      </div>
    </section>
  );
}

export default function ConfigForm({ initial, updatedAt, save }) {
  const [sectors, setSectors] = useState(initial.sectors);
  const [stages, setStages] = useState(initial.stages);
  // Aliases/keywords are edited as comma-separated text and split on save.
  const [watchlist, setWatchlist] = useState(initial.watchlist.map((w) => ({ name: w.name, aliases: (w.aliases || []).join(', ') })));
  const [portfolio, setPortfolio] = useState(
    initial.portfolio.map((p) => ({ name: p.name, sector: p.sector, keywords: (p.keywords || []).join(', ') }))
  );
  const [status, setStatus] = useState(null);
  const [dirty, setDirty] = useState(false);

  const touch = (fn) => (...args) => { setDirty(true); setStatus(null); fn(...args); };
  const updateAt = (list, setList, i, field, value) => setList(list.map((x, j) => (j === i ? { ...x, [field]: value } : x)));

  async function onSave() {
    setStatus('saving');
    const res = await save({
      sectors,
      stages,
      watchlist: watchlist.map((w) => ({ name: w.name, aliases: splitList(w.aliases) })),
      portfolio: portfolio.map((p) => ({ name: p.name, sector: p.sector, keywords: splitList(p.keywords) })),
    });
    setStatus(res.ok ? 'saved' : res.error);
    if (res.ok) setDirty(false);
  }

  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Config</h1>
          <p>What the Monday brief looks for. Changes apply from the next run.</p>
        </div>
        <span className="pill">Last saved {updatedAt} IST</span>
      </div>

      <ChipList title="Focus sectors" hint="Ranked first in the brief" values={sectors} onChange={touch(setSectors)} placeholder="Add a sector, e.g. agritech" />
      <ChipList title="Focus stages" hint="Combined with sectors for focus deals" values={stages} onChange={touch(setStages)} placeholder="Add a stage, e.g. Series B" />

      <section className="card">
        <div className="card-title">
          <h2>Watchlist</h2>
          <span className="hint">Flagged at the top · each gets its own news search</span>
        </div>
        {watchlist.map((w, i) => (
          <div className="entry" key={i}>
            <div className="row">
              <div>
                <label>Company</label>
                <input value={w.name} placeholder="e.g. Zepto" onChange={(e) => touch(updateAt)(watchlist, setWatchlist, i, 'name', e.target.value)} />
              </div>
              <button type="button" className="ghost" onClick={touch(() => setWatchlist(watchlist.filter((_, j) => j !== i)))}>Remove</button>
            </div>
            <div>
              <label>Also known as (comma-separated)</label>
              <input value={w.aliases} placeholder="e.g. Kiranakart" onChange={(e) => touch(updateAt)(watchlist, setWatchlist, i, 'aliases', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="secondary" onClick={touch(() => setWatchlist([...watchlist, { name: '', aliases: '' }]))}>+ Add company</button>
      </section>

      <section className="card">
        <div className="card-title">
          <h2>Portfolio</h2>
          <span className="hint">Same sector + a keyword = possible adjacency</span>
        </div>
        {portfolio.map((p, i) => (
          <div className="entry" key={i}>
            <div className="row">
              <div>
                <label>Portfolio company</label>
                <input value={p.name} onChange={(e) => touch(updateAt)(portfolio, setPortfolio, i, 'name', e.target.value)} />
              </div>
              <div>
                <label>Sector</label>
                <input value={p.sector} placeholder="e.g. fintech" onChange={(e) => touch(updateAt)(portfolio, setPortfolio, i, 'sector', e.target.value)} />
              </div>
              <button type="button" className="ghost" onClick={touch(() => setPortfolio(portfolio.filter((_, j) => j !== i)))}>Remove</button>
            </div>
            <div>
              <label>Keywords (comma-separated)</label>
              <input value={p.keywords} placeholder="e.g. UPI, lending" onChange={(e) => touch(updateAt)(portfolio, setPortfolio, i, 'keywords', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="secondary" onClick={touch(() => setPortfolio([...portfolio, { name: '', sector: '', keywords: '' }]))}>+ Add portfolio company</button>
      </section>

      <div className="savebar">
        <span className="muted" style={{ fontSize: 14 }}>
          {status === 'saved' ? <span className="ok">✓ Saved.</span> : status && status !== 'saving' ? <span className="fail">{status}</span> : dirty ? 'You have unsaved changes.' : 'All changes saved.'}
        </span>
        <button type="button" onClick={onSave} disabled={status === 'saving' || !dirty}>
          {status === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </main>
  );
}
