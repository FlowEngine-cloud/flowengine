import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthContext';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'FlowEngine Portal',
  description: 'Open-source client portal for automation agencies. Manage teams, invite clients, build templates, connect your own n8n.',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className='dark' suppressHydrationWarning style={{ backgroundColor: '#000000' }}>
      <head>
        <style dangerouslySetInnerHTML={{__html: `
          html, body {
            background-color: #000000;
            margin: 0;
            padding: 0;
          }
        `}} />
      </head>
      <body className='antialiased' style={{ backgroundColor: '#000000' }}>
        <AuthProvider>
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
