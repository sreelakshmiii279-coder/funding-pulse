import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'fp_admin';

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// The cookie stores a hash of the password, never the password itself.
export function adminToken() {
  return createHash('sha256').update(`funding-pulse:${process.env.ADMIN_PASSWORD}`).digest('hex');
}

export function checkPassword(password) {
  return Boolean(process.env.ADMIN_PASSWORD) && safeEqual(password, process.env.ADMIN_PASSWORD);
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const jar = await cookies();
  return safeEqual(jar.get(ADMIN_COOKIE)?.value || '', adminToken());
}

// Vercel cron sends "Authorization: Bearer <CRON_SECRET>".
export function isCron(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && safeEqual(request.headers.get('authorization') || '', `Bearer ${secret}`);
}
