import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bharat AI Office',
  description: 'A living 2D office floor for your AI employee agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
