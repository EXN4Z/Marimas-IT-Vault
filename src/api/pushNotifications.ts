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