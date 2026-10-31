'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// সবসময় provider এর ভেতরে, যাতে প্রথম মুহূর্ত থেকেই সব পেজে থিম বদলানো যায় (আগে mount এর পরে মোড়ানো হত,
// তাতে পুরো পেজ দুবার তৈরি হত আর শুরুতে toggle কাজ করত না)। <html> এ suppressHydrationWarning আছে।
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange enableColorScheme={false}>
      {children}
    </NextThemesProvider>
  );
}
