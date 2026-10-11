import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, adminToken, checkPassword } from '@/lib/auth';

const safePath = (p) => (typeof p === 'string' && p.startsWith('/') && !p.startsWith('//') ? p : '/admin');

async function login(formData) {
  'use server';
  const next = safePath(String(formData.get('next') || ''));
  if (!checkPassword(String(formData.get('password') || ''))) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}

export default async function LoginPage({ searchParams }) {
  const { error, next } = await searchParams;
  return (
    <main className="page auth">
      <form action={login} className="card">
        <h1 style={{ marginTop: 0, fontSize: 22 }}>Admin login</h1>
        <p className="muted" style={{ marginTop: -6 }}>Needed for Run now and editing the config.</p>
        <input type="hidden" name="next" value={safePath(next)} />
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" name="password" autoFocus required />
        {error && <p className="fail" style={{ fontSize: 14 }}>Wrong password. Try again.</p>}
        <button type="submit" style={{ width: '100%', marginTop: 16 }}>Log in</button>
      </form>
    </main>
  );
}
