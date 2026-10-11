import { runPipeline } from '@/lib/pipeline';
import { isAdmin, isCron } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // seconds; the whole run must finish inside this

async function handle(request) {
  const cron = isCron(request);
  if (!cron && !(await isAdmin())) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get('dry');
  try {
    const result = await runPipeline({ trigger: cron ? 'cron' : 'manual', stopAfter: dry });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error('[run] failed:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const GET = handle;  // Vercel cron
export const POST = handle; // "Run now" button
