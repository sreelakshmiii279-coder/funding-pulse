import { getConfig, query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Phase 1 check: proves the app can reach Neon and read the config row.
export async function GET() {
  try {
    const config = await getConfig();
    const [{ deals }] = await query('SELECT count(*)::int AS deals FROM deals');
    return Response.json({ ok: true, config, deals });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
