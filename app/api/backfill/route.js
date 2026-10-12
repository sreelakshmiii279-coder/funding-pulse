import { backfillWeek } from '@/lib/pipeline';
import { isAdmin, isCron } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// GET /api/backfill?weeks_ago=1..4 (admin or CRON_SECRET). One week per call
// so each stays inside the function time limit. Add &reconvert=1 to only
// re-convert that week's rupee amounts at its live exchange rate.
export async function GET(request) {
  if (!isCron(request) && !(await isAdmin())) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const weeksAgo = Number(params.get('weeks_ago'));
  const reconvertOnly = params.get('reconvert') === '1';
  if (!Number.isInteger(weeksAgo) || weeksAgo < 1 || weeksAgo > 4) {
    return Response.json({ ok: false, error: 'weeks_ago must be 1-4' }, { status: 400 });
  }
  try {
    return Response.json({ ok: true, ...(await backfillWeek({ weeksAgo, reconvertOnly })) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
