import { query, getConfig } from '@/lib/db';
import BriefDashboard from '@/components/BriefDashboard';
import BriefView from '@/components/BriefView';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [[brief], config] = await Promise.all([
    query('SELECT * FROM briefs ORDER BY created_at DESC LIMIT 1'),
    getConfig(),
  ]);
  if (!brief) {
    return (
      <main className="page narrow">
        <div className="card empty">
          <h1 style={{ fontSize: 22 }}>No brief yet</h1>
          <p className="muted">
            The first brief appears after the Monday 6:00 AM IST run, or after <a href="/admin">Run now</a>.
          </p>
        </div>
      </main>
    );
  }
  return brief.data ? <BriefDashboard brief={brief} config={config} /> : <BriefView brief={brief} />;
}
