import api from './axios';

export interface AppNotification {
  id: string;
  type: string;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationResponse {
  data: AppNotification[];
  unread_count: number;
}

export async function getNotifications(): Promise<NotificationResponse> {
  const res = await api.get<NotificationResponse>('/notifications');
  return res.data;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}