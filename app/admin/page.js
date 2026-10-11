import { redirect } from 'next/navigation';
import { query, dateOnly } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import { weekRange, istDateTime } from '@/lib/format';
import RunNow from './RunNow';

export const dynamic = 'force-dynamic';

const STEP_ORDER = ['collect', 'extract', 'match', 'brief', 'email'];
const secs = (ms) => `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;

export default async function AdminPage() {
  if (!(await isAdmin())) redirect('/login?next=/admin');

  const [[lastRun], briefs, [{ pending }]] = await Promise.all([
    query('SELECT * FROM runs ORDER BY started_at DESC LIMIT 1'),
    query('SELECT id, week_start, deals_count, sources_scanned, sources_failed, created_at FROM briefs ORDER BY created_at DESC LIMIT 30'),
    query('SELECT count(*)::int AS pending FROM manual_submissions WHERE processed = false'),
  ]);
  const sources = lastRun?.source_status || [];
  const failed = sources.filter((s) => !s.ok).length;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p>Runs automatically every Monday at 6:00 AM IST.</p>
        </div>
        <span className="pill accent">
          {pending} Telegram forward{pending === 1 ? '' : 's'} waiting
        </span>
      </div>

      <section className="card">
        <div className="card-title">
          <h2>Run the pipeline now</h2>
          <span className="hint">Collect → extract → write → email</span>
        </div>
        <RunNow />
      </section>

      <section className="card">
        <div className="card-title">
          <h2>Last run</h2>
          {lastRun && <span className="hint">#{lastRun.id} · {lastRun.trigger} · {istDateTime(lastRun.started_at)} IST</span>}
        </div>
        {!lastRun ? (
          <p className="muted">No runs yet.</p>
        ) : (
          <>
            <div className="kv">
              <span className={`pill ${lastRun.status === 'ok' ? 'ok' : lastRun.status === 'error' ? 'fail' : 'warn'}`}>
                <span className="dot" /> {lastRun.status}
              </span>
              <span className={`pill ${failed ? 'warn' : ''}`}>{sources.length} sources, {failed} failed</span>
              {STEP_ORDER.filter((k) => lastRun.timings?.[`${k}_ms`] != null).map((k) => (
                <span key={k} className="pill num">{k} {secs(lastRun.timings[`${k}_ms`])}</span>
              ))}
            </div>
            {lastRun.error && <p className="notice fail">{lastRun.error}</p>}
            <div className="scroll">
              <table className="table">
                <thead>
                  <tr><th>Source</th><th>Type</th><th>Status</th><th className="right">Items</th><th className="right">Last 7 days</th></tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name.replace(/^GN: /, '')}</td>
                      <td className="muted">{s.origin === 'rss' ? 'RSS feed' : 'Google News'}</td>
                      <td title={s.error || ''}>
                        <span className={s.ok ? 'ok' : 'fail'}><span className="dot" /> {s.ok ? 'OK' : 'Failed'}</span>
                      </td>
                      <td className="right num">{s.items}</td>
                      <td className="right num">{s.fresh ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-title"><h2>Past briefs</h2></div>
        {!briefs.length ? (
          <p className="muted">None yet.</p>
        ) : (
          <div className="scroll">
            <table className="table">
              <thead>
                <tr><th>Week</th><th className="right">Deals</th><th className="right">Sources (failed)</th><th>Generated</th></tr>
              </thead>
              <tbody>
                {briefs.map((b) => (
                  <tr key={b.id}>
                    <td><a href={`/briefs/${b.id}`}>{weekRange(dateOnly(b.week_start))}</a></td>
                    <td className="right num">{b.deals_count}</td>
                    <td className="right num">{b.sources_scanned} ({b.sources_failed})</td>
                    <td className="muted">{istDateTime(b.created_at)} IST</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
