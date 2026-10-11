'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// The run is one long request, so progress is estimated from typical step
// timings (collect ~5s, extract ~2 min, write ~10s, email ~1s).
const STEPS = [
  { name: 'Collecting feeds', until: 6 },
  { name: 'Extracting deals with Gemini', until: 130 },
  { name: 'Writing the brief', until: 145 },
  { name: 'Emailing', until: 150 },
];

export default function RunNow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - t0) / 1000), 500);
    return () => clearInterval(id);
  }, [busy]);

  async function run() {
    setBusy(true);
    setElapsed(0);
    setResult(null);
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult({ ok: true, data });
    } catch (err) {
      setResult({ ok: false, error: err.message });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  const current = STEPS.findIndex((s) => elapsed < s.until);
  const step = current === -1 ? STEPS.length - 1 : current;
  const pct = Math.min(95, (elapsed / STEPS[STEPS.length - 1].until) * 100);

  return (
    <div className="run-panel">
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={run} disabled={busy}>
          {busy ? 'Running…' : 'Run now'}
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          {busy ? `${Math.round(elapsed)}s elapsed · usually about 2–3 minutes` : 'Builds a fresh brief from the last 7 days and emails it.'}
        </span>
      </div>

      {busy && (
        <>
          <div className="progress"><div style={{ width: `${pct}%` }} /></div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <span key={s.name} className={i < step ? 'done' : i === step ? 'current' : ''}>
                {i < step ? '✓ ' : ''}{s.name}{i < STEPS.length - 1 ? ' →' : ''}
              </span>
            ))}
          </div>
        </>
      )}

      {result?.ok && (
        <div className="notice ok">
          <strong>Done.</strong> {result.data.counts.after_prefilter} candidate stories → {result.data.extract.unique_deals} deals
          ({result.data.extract.inserted} new). Email {result.data.email.sent ? 'sent' : `not sent: ${result.data.email.error}`}.{' '}
          <a href="/">View the brief →</a>
        </div>
      )}
      {result && !result.ok && <div className="notice fail">Run failed: {result.error}</div>}
    </div>
  );
}
