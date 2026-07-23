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
    } catch {
      setIsSubscribed(false);
    }
  }, [isSupported]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !VAPID_PUBLIC_KEY) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      setStatus(permission as PushStatus);
      if (permission !== 'granted') return;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
        });
      }

      await savePushSubscription(subscription);
      setIsSubscribed(true);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, isSubscribed, loading, isSupported, subscribe, unsubscribe };
}