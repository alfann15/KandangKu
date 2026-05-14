'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster />
    </SessionProvider>
  );
}
