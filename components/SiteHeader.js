'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Brief' },
  { href: '/admin', label: 'Admin' },
  { href: '/config', label: 'Config' },
];

export default function SiteHeader() {
  const path = usePathname();
  const active = (href) => (href === '/' ? path === '/' || path.startsWith('/briefs') : path.startsWith(href));
  return (
    <header className="site-header">
      <div className="inner">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
          </span>
          <span>
            Funding Pulse
            <small>Indian startup funding, weekly</small>
          </span>
        </a>
        <nav className="nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className={active(l.href) ? 'active' : undefined}>
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
