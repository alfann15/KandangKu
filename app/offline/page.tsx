'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Loader2 } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const checkPending = async () => {
      try {
        const { getPendingTransaksi, getPendingPengeluaran } = await import('@/lib/offline-sync');
        const transaksi = await getPendingTransaksi();
        const pengeluaran = await getPendingPengeluaran();
        setPendingCount(transaksi.length + pengeluaran.length);
      } catch (error) {
        console.error('Error checking pending:', error);
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {isOnline ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <WifiOff className="h-8 w-8 text-amber-600" />
              </div>
            )}
          </div>
          <CardTitle>
            {isOnline ? 'Menyinkronkan Data' : 'Mode Offline'}
          </CardTitle>
          <CardDescription>
            {isOnline
              ? 'Aplikasi sedang menyinkronkan data yang tertunda...'
              : 'Anda sedang offline. Transaksi akan disimpan secara lokal dan disinkronkan saat online.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingCount > 0 && (
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Data tertunda:</p>
              <Badge className="mt-2">{pendingCount} item</Badge>
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">
            {isOnline
              ? 'Jangan tutup halaman ini sampai sinkronisasi selesai.'
              : 'Anda masih bisa menggunakan aplikasi. Data akan disimpan secara lokal.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
