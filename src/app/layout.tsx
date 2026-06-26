import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/index.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Helm Manager',
  description: 'Helm Chart and Kubernetes Release Manager',
  icons: {
    icon: [
      { url: '/static/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/static/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/static/favicon/favicon.ico',
    apple: '/static/favicon/apple-touch-icon.png',
  },
  manifest: '/static/favicon/site.webmanifest',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" sizes="192x192" href="/static/favicon/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/static/favicon/android-chrome-512x512.png" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
