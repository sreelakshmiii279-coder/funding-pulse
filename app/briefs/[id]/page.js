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
  return brief.data ? <BriefDashboard brief={brief} config={config} /> : <BriefView brief={brief} />;
}
