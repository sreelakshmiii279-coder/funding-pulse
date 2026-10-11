import './globals.css';

export const metadata = {
  title: 'Funding Pulse',
  description: 'Weekly Indian startup funding brief for Aarav',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <nav className="nav">
            <a className="brand" href="/">Funding Pulse</a>
            <a href="/admin">Admin</a>
            <a href="/config">Config</a>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
