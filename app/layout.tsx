import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PLATFORMS } from '@/lib/platform';
import { currentPlatform } from '@/lib/currentPlatform';
import { ThemeProvider } from '@/components/ThemeProvider';
import CourseProvider from '@/components/CourseProvider';

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

// কোর্স অনুযায়ী নাম (med/ka/kha/eng; ক্লাসরুমে বাছাই করা কোর্স)
export async function generateMetadata(): Promise<Metadata> {
  const p = PLATFORMS[await currentPlatform()];
  return {
  title: p.title,
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: p.short,
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Noto Sans Bengali সরাসরি CDN থেকে লোড */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* KaTeX CSS */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-slate-50 dark:bg-[#0B1120] min-h-screen antialiased">
        <ThemeProvider>
          <CourseProvider>{children}</CourseProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}