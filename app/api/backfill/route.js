import { backfillWeek } from '@/lib/pipeline';
import { isAdmin, isCron } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// GET /api/backfill?weeks_ago=1..4 (admin or CRON_SECRET). One week per call
// so each stays inside the function time limit.
export async function GET(request) {
  if (!isCron(request) && !(await isAdmin())) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const weeksAgo = Number(new URL(request.url).searchParams.get('weeks_ago'));
  if (!Number.isInteger(weeksAgo) || weeksAgo < 1 || weeksAgo > 4) {
    return Response.json({ ok: false, error: 'weeks_ago must be 1-4' }, { status: 400 });
  }
  try {
    return Response.json({ ok: true, ...(await backfillWeek({ weeksAgo })) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
