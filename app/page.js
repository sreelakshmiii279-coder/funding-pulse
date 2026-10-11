import { query } from '@/lib/db';
import BriefView from '@/components/BriefView';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [brief] = await query('SELECT * FROM briefs ORDER BY created_at DESC LIMIT 1');
  if (!brief) {
    return (
      <div className="card">
        <h1>No brief yet</h1>
        <p className="muted">
          The first brief appears after the Monday 6:00 AM IST run, or after Run now on the admin page.
        </p>
      </div>
    );
  }
  return <BriefView brief={brief} />;
}
