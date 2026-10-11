import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import BriefView from '@/components/BriefView';

export const dynamic = 'force-dynamic';

export default async function BriefPage({ params }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [brief] = await query('SELECT * FROM briefs WHERE id = $1', [Number(id)]);
  if (!brief) notFound();
  return <BriefView brief={brief} />;
}
