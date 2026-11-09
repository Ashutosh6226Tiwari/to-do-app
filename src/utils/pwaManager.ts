/**
 * PWA Management Utility for Lumo
 * - Service worker registration, update handling, offline detection
 * - In-app install prompt capture (Android Chrome) & iOS Safari guidance
 * - Service worker system notifications for timer completion
 * - Media Session API metadata for lock-screen controls
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let updateAvailableCallback: (() => void) | null = null;

// Initialize beforeinstallprompt listener as early as possible
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('lumo-installable-change'));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    window.dispatchEvent(new CustomEvent('lumo-installable-change'));
  });
}

/**
 * Registers the service worker with update detection
 */
export function registerLumoServiceWorker(onUpdateAvailable?: () => void) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (onUpdateAvailable) {
    updateAvailableCallback = onUpdateAvailable;
  }

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // If a waiting worker already exists
        if (registration.waiting) {
          notifyUpdateAvailable();
        }

        // When a new worker is discovered
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              notifyUpdateAvailable();
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[Lumo PWA] Service worker registration error:', err);
      });

    // Listen for controllerchange to reload if needed
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}

function notifyUpdateAvailable() {
  if (updateAvailableCallback) {
    updateAvailableCallback();
  }
  window.dispatchEvent(new CustomEvent('lumo-sw-update-available'));
}

/**
 * Tells the waiting service worker to skip waiting and activate
 */
export function applyServiceWorkerUpdate() {
  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }

  navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg && reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  });
}

/**
 * Returns whether the app is currently running as an installed standalone PWA
 */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Returns whether an Android/Chrome install prompt is currently ready
 */
export function isInstallPromptAvailable(): boolean {
  return deferredInstallPrompt !== null;
}

/**
 * Detects whether the current device is iOS
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

/**
 * Prompts the user to install Lumo on Chromium/Android
 */
export async function promptPWAInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  try {
    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    window.dispatchEvent(new CustomEvent('lumo-installable-change'));
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

/**
 * Asks for system notification permission (only called upon user interaction)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  return Notification.requestPermission();
}

/**
 * Sends a system timer completion notification via service worker
 */
export async function showTimerCompletionNotification(
  title: string,
  body: string
) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  if (Notification.permission !== 'granted') {
    return;
  }

  const payload = {
    title,
    options: {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'lumo-session-complete',
      renotify: true,
      silent: false,
    },
  };

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.showNotification) {
        await reg.showNotification(payload.title, payload.options);
        return;
      }
    } catch {
      // fallback
    }
  }

  // Fallback direct Notification if SW is not active
  try {
    new Notification(payload.title, payload.options);
  } catch {
    // ignore
  }
}

/**
 * Updates Media Session API metadata and lock-screen audio handlers
 */
export function syncMediaSessionState(params: {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}) {
  if (
    typeof window === 'undefined' ||
    !('mediaSession' in navigator) ||
    !window.MediaMetadata
  ) {
    return;
  }

  if (params.isPlaying) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: params.title || 'Lumo - Focus session',
      artist: params.artist || 'Lumo Ambient Mixer',
      album: 'Study Flow',
      artwork: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    });

    navigator.mediaSession.playbackState = 'playing';

    if (params.onPlay) {
      navigator.mediaSession.setActionHandler('play', params.onPlay);
    }
    if (params.onPause) {
      navigator.mediaSession.setActionHandler('pause', params.onPause);
    }
    if (params.onStop) {
      navigator.mediaSession.setActionHandler('stop', params.onStop);
    }
  } else {
    navigator.mediaSession.playbackState = 'paused';
  }
}
