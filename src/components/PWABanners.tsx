import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import { MoodThemeConfig } from '../types';
import { applyServiceWorkerUpdate } from '../utils/pwaManager';

interface PWABannersProps {
  themeConfig: MoodThemeConfig;
}

export function PWABanners({ themeConfig }: PWABannersProps) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener('lumo-sw-update-available', handleUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('lumo-sw-update-available', handleUpdate);
    };
  }, []);

  return (
    <>
      {/* 1. Offline Banner */}
      {!isOnline && (
        <aside
          role="status"
          aria-live="polite"
          data-testid="offline-banner"
          aria-label="Offline status banner"
          className="fixed top-3 inset-x-3 sm:inset-x-auto sm:right-6 sm:left-auto z-50 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-500/90 dark:bg-amber-600/90 text-white shadow-xl backdrop-blur-md border border-white/20 text-xs font-semibold"
        >
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
            <span>You&apos;re offline. Lumo is running from local cache.</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-white shrink-0" />
        </aside>
      )}

      {/* 2. Service Worker Update Prompt */}
      {updateAvailable && (
        <aside
          role="alert"
          aria-live="assertive"
          data-testid="update-banner"
          aria-label="App update available"
          className="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-50 flex items-center justify-between gap-3 p-4 rounded-2xl bg-sky-600 text-white shadow-2xl backdrop-blur-md border border-white/30 text-xs max-w-sm"
        >
          <div className="flex items-start gap-2.5">
            <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
            <div>
              <p className="font-bold">New version available</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                A new update for Lumo is ready. Refresh to activate.
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="pwa-refresh-update-btn"
            onClick={applyServiceWorkerUpdate}
            className="px-3 py-1.5 rounded-xl bg-white text-sky-700 hover:bg-sky-50 font-bold shrink-0 shadow-sm transition-all text-xs"
          >
            Refresh
          </button>
        </aside>
      )}
    </>
  );
}
