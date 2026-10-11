import { runPipeline } from '@/lib/pipeline';
import { isCron } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // seconds; the whole run must finish inside this

// GET is the Vercel cron and must carry CRON_SECRET, so crawlers or anyone
// opening the URL can't start a run. POST is the open "Run now" button.
async function handle(request, trigger) {
  if (trigger === 'cron' && !isCron(request)) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get('dry');
  try {
    const result = await runPipeline({ trigger, stopAfter: dry });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('[run] failed:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const GET = (request) => handle(request, 'cron');
export const POST = (request) => handle(request, 'manual');
