'use client';

import { useState } from 'react';

const splitList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

// A list of short text values shown as removable chips, plus an "Add" box.
function ChipList({ label, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <section className="card">
      <h2 style={{ marginTop: 0, fontSize: 18 }}>{label}</h2>
      <div className="chips">
        {values.map((v) => (
          <span className="chip" key={v}>
            {v}
            <button type="button" className="link" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
          </span>
        ))}
        {!values.length && <span className="muted">None.</span>}
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

  const updateAt = (list, setList, i, field, value) =>
    setList(list.map((x, j) => (j === i ? { ...x, [field]: value } : x)));

  async function onSave() {
    setStatus('saving');
    const res = await save({
      sectors,
      stages,
      watchlist: watchlist.map((w) => ({ name: w.name, aliases: splitList(w.aliases) })),
      portfolio: portfolio.map((p) => ({ name: p.name, sector: p.sector, keywords: splitList(p.keywords) })),
    });
    setStatus(res.ok ? 'saved' : res.error);
  }

  return (
    <div onChange={() => status === 'saved' && setStatus(null)}>
      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Config</h1>
        <p className="muted" style={{ marginBottom: 0 }}>
          What the Monday brief looks for. Changes apply to the next run. Last saved {updatedAt} IST.
        </p>
      </div>

      <ChipList label="Focus sectors" values={sectors} onChange={setSectors} placeholder="e.g. agritech" />
      <ChipList label="Focus stages" values={stages} onChange={setStages} placeholder="e.g. Series B" />

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Watchlist</h2>
        <p className="muted">Companies you want flagged at the top of the brief. Each one also gets its own Google News search.</p>
        {watchlist.map((w, i) => (
          <div className="entry" key={i}>
            <div className="row">
              <div>
                <label>Company name</label>
                <input value={w.name} onChange={(e) => updateAt(watchlist, setWatchlist, i, 'name', e.target.value)} />
              </div>
              <button type="button" className="link" onClick={() => setWatchlist(watchlist.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <div>
              <label>Other names it appears under (comma-separated)</label>
              <input value={w.aliases} onChange={(e) => updateAt(watchlist, setWatchlist, i, 'aliases', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => setWatchlist([...watchlist, { name: '', aliases: '' }])}>+ Add company</button>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Portfolio</h2>
        <p className="muted">
          A deal is flagged as a <em>possible</em> adjacency when it is in the same sector and mentions one of the keywords.
        </p>
        {portfolio.map((p, i) => (
          <div className="entry" key={i}>
            <div className="row">
              <div>
                <label>Portfolio company</label>
                <input value={p.name} onChange={(e) => updateAt(portfolio, setPortfolio, i, 'name', e.target.value)} />
              </div>
              <div>
                <label>Sector</label>
                <input value={p.sector} onChange={(e) => updateAt(portfolio, setPortfolio, i, 'sector', e.target.value)} />
              </div>
              <button type="button" className="link" onClick={() => setPortfolio(portfolio.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <div>
              <label>Keywords (comma-separated)</label>
              <input value={p.keywords} onChange={(e) => updateAt(portfolio, setPortfolio, i, 'keywords', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => setPortfolio([...portfolio, { name: '', sector: '', keywords: '' }])}>+ Add portfolio company</button>
      </section>

      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <button type="button" onClick={onSave} disabled={status === 'saving'}>{status === 'saving' ? 'Saving…' : 'Save'}</button>
        {status === 'saved' && <span className="ok">Saved.</span>}
        {status && status !== 'saved' && status !== 'saving' && <span className="fail">{status}</span>}
      </div>
    </div>
  );
}
