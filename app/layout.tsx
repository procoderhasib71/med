import type { Metadata, Viewport } from 'next';
import './globals.css';
import { cookies, headers } from 'next/headers';
import { PLATFORMS, isClassroomHost } from '@/lib/platform';
import { currentPlatform } from '@/lib/currentPlatform';
import { ThemeProvider } from '@/components/ThemeProvider';
import CourseProvider from '@/components/CourseProvider';
import AppShell from '@/components/AppShell';
import { LangProvider } from '@/lib/i18n';
import { LANG_COOKIE, type Lang } from '@/lib/langCookie';

export const viewport: Viewport = {
  // Focus/Money এর মতো: উপরের বারের রং ফোনের লাইট/ডার্ক অনুযায়ী (আগে সবসময় সবুজ ছিল)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1120' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

// iOS এ হোম স্ক্রিন থেকে খুললে প্রথমে এই ছবি দেখায় (public/splash), নইলে সাদা ঝলক আসে। প্রতিটা iPhone/iPad এর মাপে light আর dark।
const SPLASH_SIZES: [number, number, number][] = [
    [440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
    [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
    [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [768, 1024, 2],
];
const startupImage = SPLASH_SIZES.flatMap(([w, h, r]) =>
    (['light', 'dark'] as const).map((theme) => ({
        url: `/splash/${theme}-${w * r}x${h * r}.png`,
        media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`,
    })),
);

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
    startupImage,
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ক্লাসরুমে লগইন আর কোর্স যাচাইয়ের আগে পেজ দেখানো হয় না (নইলে হোম এক ঝলক দেখিয়ে লগইনে যায়)
  const h = await headers();
  const classroom = isClassroomHost(h.get('x-forwarded-host') || h.get('host'));
  // ছাত্রের বাছাই করা ভাষা (প্রোফাইল থেকে বদলায়), প্রথম থেকেই সেই ভাষায় পেজ
  const lang: Lang = (await cookies()).get(LANG_COOKIE)?.value === 'en' ? 'en' : 'bn';
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* CSS আসার আগেও পটভূমি থিমের রঙে, তাই খোলার সময় সাদা ঝলক আসে না */}
        <style>{`html{background:#f8fafc}@media (prefers-color-scheme:dark){html{background:#0B1120}}html.dark{background:#0B1120}html.light{background:#f8fafc}`}</style>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Noto Sans Bengali সরাসরি CDN থেকে লোড */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700;800;900&display=swap"
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
          <LangProvider initial={lang}>
            <CourseProvider classroom={classroom}><AppShell>{children}</AppShell></CourseProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}