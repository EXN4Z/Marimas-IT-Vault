import { useCallback, useEffect, useState } from 'react';
import { savePushSubscription, removePushSubscription } from '../api/pushNotifications';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// convert base64 VAPID key (format Laravel webpush) ke Uint8Array yang diminta pushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

  const refreshStatus = useCallback(async () => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }
    setStatus(Notification.permission as PushStatus);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.error('[usePushNotifications] refreshStatus failed:', err);
      setIsSubscribed(false);
    }
  }, [isSupported]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const subscribe = useCallback(async () => {
    setError(null);

    if (!isSupported) {
      const msg = 'Browser ini tidak mendukung push notification (serviceWorker/PushManager tidak tersedia).';
      console.error('[usePushNotifications]', msg);
      setError(msg);
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      const msg = 'VITE_VAPID_PUBLIC_KEY tidak ditemukan. Cek environment variable saat build (mis. di Railway, pastikan di-set sebagai build-time env var, bukan hanya di .env lokal).';
      console.error('[usePushNotifications]', msg);
      setError(msg);
      return;
    }

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      setStatus(permission as PushStatus);
      if (permission !== 'granted') {
        console.warn('[usePushNotifications] permission tidak granted:', permission);
        return;
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      await savePushSubscription(subscription);
      setIsSubscribed(true);
    } catch (err) {
      // Ini bagian yang tadinya hilang — tanpa catch, error di sini
      // (mis. savePushSubscription gagal, subscribe() ditolak browser,
      // atau applicationServerKey invalid) akan silent-fail: loading
      // balik ke false tanpa tanda apapun bahwa proses gagal.
      console.error('[usePushNotifications] subscribe failed:', err);
      setError(err instanceof Error ? err.message : 'Gagal subscribe push notification.');
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[usePushNotifications] unsubscribe failed:', err);
      setError(err instanceof Error ? err.message : 'Gagal unsubscribe push notification.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, isSubscribed, loading, error, isSupported, subscribe, unsubscribe };
}