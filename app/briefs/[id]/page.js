import { notFound } from 'next/navigation';
import { query, getConfig } from '@/lib/db';
import BriefDashboard from '@/components/BriefDashboard';
import BriefView from '@/components/BriefView';

export const dynamic = 'force-dynamic';

export default async function BriefPage({ params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [[brief], config] = await Promise.all([
    query('SELECT * FROM briefs WHERE id = $1', [Number(id)]),
    getConfig(),
  ]);
  if (!brief) notFound();
  const [{ issue }] = await query('SELECT count(DISTINCT week_start)::int AS issue FROM briefs WHERE week_start <= $1', [brief.week_start]);
  return brief.data ? <BriefDashboard brief={brief} config={config} issue={issue} /> : <BriefView brief={brief} />;
}
