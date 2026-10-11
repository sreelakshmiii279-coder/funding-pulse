'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RunNow() {
  const router = useRouter();
  const [state, setState] = useState({ busy: false, msg: null, ok: true });

  async function run() {
    setState({ busy: true, msg: 'Running: collecting feeds, extracting deals, writing brief. This takes 1–3 minutes…', ok: true });
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const s = data.extract;
      setState({
        busy: false,
        ok: true,
        msg:
          `Done. ${data.counts.after_prefilter} candidate items → ${s.unique_deals} deals (${s.inserted} new). ` +
          `Email: ${data.email.sent ? 'sent' : `not sent (${data.email.error})`}.`,
      });
      router.refresh();
    } catch (err) {
      setState({ busy: false, ok: false, msg: `Run failed: ${err.message}` });
      router.refresh();
    }
  }

  return (
    <div>
      <button onClick={run} disabled={state.busy}>{state.busy ? 'Running…' : 'Run now'}</button>
      {state.msg && <p className={state.ok ? 'notice' : 'fail'}>{state.msg}</p>}
    </div>
  );
}
