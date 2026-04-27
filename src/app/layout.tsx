import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'mtg-duel — Cube draft assistant',
  description: 'AI-assisted Magic: the Gathering cube drafting (MTGO Vintage Cube)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
