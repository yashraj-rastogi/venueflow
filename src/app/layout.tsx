import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'VenueFlow — Real-time Crowd Intelligence',
  description: 'Navigate every moment. VenueFlow provides live crowd density tracking, wait time predictions, and smart navigation for large sporting venues.',
  keywords: ['venue', 'stadium', 'crowd management', 'real-time', 'navigation', 'wait times'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable    : true,
    statusBarStyle: 'black-translucent',
    title      : 'VenueFlow',
  },
  openGraph: {
    title      : 'VenueFlow',
    description: 'Real-time crowd intelligence for sporting venues',
    type       : 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ background: '#080c18' }} className="antialiased">
        {children}
      </body>
    </html>
  );
}
