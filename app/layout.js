import { Inter, Instrument_Serif } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata = {
  title: 'Funding Pulse · Weekly Indian startup funding brief',
  description: 'A Monday-morning brief of last week’s Indian startup funding: focus deals, watchlist alerts, sector trends and investor moves.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <div className="inner">
            <div>
              <div className="brand-name">Funding Pulse</div>
              <p>
                Weekly Indian startup funding intelligence for Aarav, a venture scout at a Bengaluru family office. Every
                deal links to its source. Informational only, not investment advice.
              </p>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>How it&apos;s built</div>
              <p>
                Publisher RSS · Google News · GDELT · Telegram forwards
                <br />
                Gemini Flash for extraction, fact-checks and writing
                <br />
                Next.js · Neon Postgres · Vercel cron (Mon 06:00 IST)
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
