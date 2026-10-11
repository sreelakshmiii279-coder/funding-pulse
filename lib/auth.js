import { timingSafeEqual } from 'node:crypto';

// Vercel cron sends "Authorization: Bearer <CRON_SECRET>". Only the scheduled
// GET is checked; there is no user login (the admin pages are open by choice).
export function isCron(request) {
  const secret = process.env.CRON_SECRET;
  const a = Buffer.from(request.headers.get('authorization') || '');
  const b = Buffer.from(`Bearer ${secret}`);
  return Boolean(secret) && a.length === b.length && timingSafeEqual(a, b);
}
