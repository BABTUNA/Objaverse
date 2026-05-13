import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Objaverse Semantic Search',
  description:
    '46,000 3D models indexed by meaning. Type what you imagine; find the closest object.',
  openGraph: {
    title: 'Objaverse Semantic Search',
    description: '46,000 3D models, searched by meaning.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">
        <div className="relative z-10 min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}
