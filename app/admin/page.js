import { redirect } from 'next/navigation';
import { query, dateOnly } from '@/lib/db';
import { isAdmin } from '@/lib/auth';
import RunNow from './RunNow';

export const dynamic = 'force-dynamic';

const ist = (d) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-');

export default async function AdminPage() {
  if (!(await isAdmin())) redirect('/login?next=/admin');

  const [lastRun] = await query('SELECT * FROM runs ORDER BY started_at DESC LIMIT 1');
  const briefs = await query(
    'SELECT id, week_start, deals_count, sources_scanned, sources_failed, created_at FROM briefs ORDER BY created_at DESC LIMIT 30'
  );
  const [{ pending }] = await query('SELECT count(*)::int AS pending FROM manual_submissions WHERE processed = false');

  return (
    <>
      <section className="card">
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Admin</h1>
        <p className="muted">
          Runs automatically every Monday 6:00 AM IST. {pending} Telegram submission{pending === 1 ? '' : 's'} waiting.
        </p>
        <RunNow />
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Last run</h2>
        {!lastRun ? (
          <p className="muted">No runs yet.</p>
        ) : (
          <>
            <p>
              #{lastRun.id} · {lastRun.trigger} · started {ist(lastRun.started_at)} ·{' '}
              <span className={lastRun.status === 'ok' ? 'ok' : lastRun.status === 'error' ? 'fail' : ''}>{lastRun.status}</span>
              {lastRun.timings && Object.keys(lastRun.timings).length > 0 && (
                <span className="muted">
                  {' '}· {Object.entries(lastRun.timings).map(([k, v]) => `${k.replace('_ms', '')} ${(v / 1000).toFixed(1)}s`).join(', ')}
                </span>
              )}
            </p>
            {lastRun.error && <p className="fail">{lastRun.error}</p>}
            <div className="scroll">
              <table>
                <thead>
                  <tr><th>Source</th><th>Type</th><th>Status</th><th>Items</th><th>Last 7 days</th></tr>
                </thead>
                <tbody>
                  {lastRun.source_status.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="muted">{s.origin === 'rss' ? 'RSS' : 'Google News'}</td>
                      <td className={s.ok ? 'ok' : 'fail'} title={s.error || ''}>{s.ok ? 'ok' : 'failed'}</td>
                      <td>{s.items}</td>
                      <td>{s.fresh ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Past briefs</h2>
        {!briefs.length ? (
          <p className="muted">None yet.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Week of</th><th>Deals</th><th>Sources (failed)</th><th>Generated (IST)</th></tr>
              </thead>
              <tbody>
                {briefs.map((b) => (
                  <tr key={b.id}>
                    <td><a href={`/briefs/${b.id}`}>{dateOnly(b.week_start)}</a></td>
                    <td>{b.deals_count}</td>
                    <td>{b.sources_scanned} ({b.sources_failed})</td>
                    <td>{ist(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
