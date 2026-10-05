import api from './axios';

interface WebPushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON() as WebPushSubscriptionPayload;
  await api.post('/push-subscriptions', {
    endpoint: json.endpoint,
    keys: json.keys,
  });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await api.delete('/push-subscriptions', { data: { endpoint } });
}

// Dipanggil pas logout. Push subscription itu nempel ke browser/device, bukan
// ke sesi login -- kalau gak dicabut di sini, device yang dipakai gonta-ganti
// akun (device sharing) bakal tetep nerima notif push punya akun sebelumnya,
// dan akun berikutnya yang coba subscribe bisa error karena endpoint sama
// masih "dimiliki" akun lama (kolom endpoint unique global di DB).
export async function unsubscribeThisDevice(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await removePushSubscription(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  } catch {
    // best-effort, gak perlu blocking proses logout
  }
}