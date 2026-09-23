import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

// Self-hosted by Next at build time (no runtime request to Google), used as
// the `sans` family for UI chrome/content — mono stays reserved for
// technical readouts (timestamps, token counts, model tags, the terminal
// feed). See tailwind.config.ts's fontFamily.sans → var(--font-inter).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Bharat AI Office',
  description: 'A living 2D office floor for your AI employee agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
