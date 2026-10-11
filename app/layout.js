import { Inter } from 'next/font/google';
import SiteHeader from '@/components/SiteHeader';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: 'Funding Pulse',
  description: 'Weekly Indian startup funding brief for Aarav',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
