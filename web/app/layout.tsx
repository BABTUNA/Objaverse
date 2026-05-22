import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Single typeface family across the app. Display weights (700/800/900) carry
// the hero headline at large sizes; the regular weights handle body text.
// Inter at tight tracking reads as the geometric display sans in the reference.
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
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
    <html lang="en" className={sans.variable}>
      <body className="font-sans antialiased">
        <div className="relative z-10 min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}
